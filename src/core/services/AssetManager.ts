/**
 * AssetManager — quản lý insert/remove `<style>` và `<script>` của component (View)
 * vào real DOM theo cơ chế **reference-counting**.
 *
 * Bối cảnh (Component = View — page/layout/super/nested đều là View):
 *   Mỗi `.sao` có thể khai báo `<style>` và `<script>` (không phải script
 *   `export default` — cái đó là method của component, do compiler gom vào
 *   userDefined). Style/link có mặt khi có ÍT NHẤT một instance đang sống;
 *   script đã execute được giữ tới teardown để không chạy lại ngoài ý muốn.
 *
 * Quy tắc (theo thiết kế):
 *   1. Global style/link/script dùng identity của chính asset để các View khác
 *      path vẫn dùng chung. Scoped style thêm component path vào identity.
 *   2. Insert đúng MỘT lần — khi ref 0 → 1. Các instance sau không insert lại.
 *   3. Style/link remove khi ref 1 → 0; nếu nơi khác còn ref thì phải giữ.
 *   4. Style/link remove khi ref về 0. Script đã execute thì giữ tới teardown
 *      document, vì remove tag không hoàn tác side effect và reinsert sẽ chạy lại.
 *
 * Style:
 *   - `scoped` → CSS chỉ áp dụng cho subtree của component (prefix selector bằng
 *     scope-id ổn định theo path, tag subtree instance bằng attribute tương ứng).
 *   - không `scoped` → global, insert nguyên văn vào <head>.
 *
 * Idempotency ở phía instance do `ViewController._assetsLive` đảm bảo (mỗi ctrl
 * acquire/release tối đa một lần mỗi vòng), nên ref-count ở đây luôn cân bằng.
 */

/** Một khai báo `<style>` (từ compiler register_data.styles). */
export interface StyleSpec {
    /** 'code' = inline CSS; 'href' = external stylesheet. */
    type: 'code' | 'href';
    content?: string;
    href?: string;
    /** true → scoped vào component; mặc định false → global. */
    scoped?: boolean;
    id?: string;
    className?: string;
    attributes?: Record<string, any>;
}

/** Một khai báo `<script>` không-export (script thường / external). */
export interface ScriptSpec {
    /** 'code' = inline JS; 'src' = external script. */
    type: 'code' | 'src';
    content?: string;
    src?: string;
    id?: string;
    className?: string;
    attributes?: Record<string, any>;
}

/** Thuộc tính đánh dấu node do AssetManager tạo (để debug / không đụng node khác). */
const OWNER_ATTR = 'data-sao-asset';
/** Attribute scope cho scoped style — value = scopeId của component path. */
export const SCOPE_ATTR = 'data-sao-scope';

interface AssetRecord {
    refs: number;
    node: HTMLElement | null;
}

export class AssetManagerService {
    /** key = semantic asset identity → record (ref-count + DOM node). */
    private records: Map<string, AssetRecord> = new Map();
    /** Legacy/debug lookup `(path, kind, index)` → semantic asset identity. */
    private leaseKeys: Map<string, string> = new Map();
    /** path → scopeId ổn định (cache để mọi instance dùng chung). */
    private scopeIds: Map<string, string> = new Map();

    private get headEl(): HTMLElement | null {
        if (typeof document === 'undefined') return null;
        return document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    }

    // ─── Public API ─────────────────────────────────────────────

    /**
     * Một instance của `path` vào real DOM → tăng ref các asset; insert khi 0→1.
     * @param subtreeRoots các node gốc của instance — dùng để tag scope cho scoped style.
     */
    acquire(path: string, styles?: StyleSpec[] | null, scripts?: ScriptSpec[] | null, subtreeRoots?: Node[] | null): void {
        if (styles && styles.length) {
            const scopeId = this.scopeIdFor(path, styles);
            styles.forEach((style, idx) => {
                const key = this.styleKey(path, style);
                this.leaseKeys.set(this.leaseKey(path, 'sty', idx), key);
                this.acquireOne(key, () => this.createStyleNode(path, style, scopeId));
            });
            // Tag scope cho subtree của instance này (mỗi instance tự tag — node <style> dùng chung).
            if (scopeId && subtreeRoots && subtreeRoots.length) {
                this.tagScope(subtreeRoots, scopeId);
            }
        }
        if (scripts && scripts.length) {
            scripts.forEach((script, idx) => {
                const key = this.scriptKey(script);
                this.leaseKeys.set(this.leaseKey(path, 'sc', idx), key);
                this.acquireOne(key, () => this.createScriptNode(script));
            });
        }
    }

    /**
     * Một instance của `path` rời real DOM → giảm ref; style/link remove khi 1→0.
     */
    release(path: string, styles?: StyleSpec[] | null, scripts?: ScriptSpec[] | null): void {
        if (styles && styles.length) {
            styles.forEach((style) => this.releaseOne(this.styleKey(path, style), true));
        }
        if (scripts && scripts.length) {
            scripts.forEach((script) => this.releaseOne(this.scriptKey(script), false));
        }
    }

    /** Tổng số node asset đang trong DOM (test/debug). */
    activeCount(): number {
        let n = 0;
        for (const rec of this.records.values()) if (rec.node) n++;
        return n;
    }

    /** Ref-count hiện tại của một asset (test/debug). */
    refCount(path: string, kind: 'sty' | 'sc', index: number): number {
        const key = this.leaseKeys.get(this.leaseKey(path, kind, index));
        return key ? this.records.get(key)?.refs ?? 0 : 0;
    }

    /** Dọn sạch — gỡ mọi node, reset (teardown app/test). */
    clear(): void {
        for (const rec of this.records.values()) {
            rec.node?.parentNode?.removeChild(rec.node);
        }
        this.records.clear();
        this.leaseKeys.clear();
        this.scopeIds.clear();
    }

    // ─── Ref-count core ─────────────────────────────────────────

    private acquireOne(key: string, factory: () => HTMLElement | null): void {
        let rec = this.records.get(key);
        if (!rec) {
            rec = { refs: 0, node: null };
            this.records.set(key, rec);
        }
        rec.refs++;
        if (rec.refs === 1 && !rec.node) {
            // 0 → 1: insert đúng một lần.
            rec.node = factory();
        }
    }

    private releaseOne(key: string, removeWhenUnused: boolean): void {
        const rec = this.records.get(key);
        if (!rec) return;
        rec.refs = Math.max(0, rec.refs - 1);
        if (rec.refs === 0 && removeWhenUnused) {
            // 1 → 0: không còn instance nào → remove.
            rec.node?.parentNode?.removeChild(rec.node);
            rec.node = null;
            this.records.delete(key);
        }
    }

    private leaseKey(path: string, kind: 'sty' | 'sc', index: number): string {
        return `${path}::${kind}::${index}`;
    }

    /**
     * Global CSS/link dedup xuyên View. Scoped CSS phải giữ path trong key vì
     * cùng source nhưng mỗi View được rewrite bằng scopeId khác nhau.
     */
    private styleKey(path: string, style: StyleSpec): string {
        const scope = style.type === 'code' && style.scoped ? `scoped:${path}` : 'global';
        return `sty::${scope}::${this.stableSerialize(style)}`;
    }

    /** Script là document-global side effect nên dedup xuyên View. */
    private scriptKey(script: ScriptSpec): string {
        return `sc::global::${this.stableSerialize(script)}`;
    }

    // ─── Style ──────────────────────────────────────────────────

    private createStyleNode(path: string, style: StyleSpec, scopeId: string): HTMLElement | null {
        const head = this.headEl;
        if (!head) return null;

        if (style.type === 'href') {
            const existing = this.findExistingStylesheet(style);
            if (existing) {
                // Adopt link do Blade SSR phát ra thay vì chèn bản thứ hai khi hydrate.
                existing.setAttribute(OWNER_ATTR, path);
                return existing;
            }
            const link = document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            if (style.href) link.setAttribute('href', style.href);
            this.applyExtraAttrs(link, style);
            link.setAttribute(OWNER_ATTR, path);
            head.appendChild(link);
            return link;
        }

        const el = document.createElement('style');
        const css = style.content ?? '';
        el.textContent = style.scoped ? this.scopeCss(css, scopeId) : css;
        if (style.scoped) el.setAttribute(SCOPE_ATTR, scopeId);
        this.applyExtraAttrs(el, style);
        el.setAttribute(OWNER_ATTR, path);
        head.appendChild(el);
        return el;
    }

    /** Tìm stylesheet SSR cùng identity để hydration không tạo node trùng. */
    private findExistingStylesheet(style: StyleSpec): HTMLLinkElement | null {
        if (typeof document === 'undefined' || !style.href) return null;
        const expectedHref = new URL(style.href, document.baseURI).href;
        const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]');
        for (const link of Array.from(links)) {
            if (link.href !== expectedHref) continue;
            if (!this.matchesExtraAttrs(link, style)) continue;
            return link;
        }
        return null;
    }

    private matchesExtraAttrs(el: HTMLElement, spec: StyleSpec): boolean {
        if (spec.id && el.id !== spec.id) return false;
        if (spec.className && el.getAttribute('class') !== spec.className) return false;
        for (const [name, value] of Object.entries(spec.attributes ?? {})) {
            if (name.toLowerCase() === 'href' || name.toLowerCase() === 'rel') continue;
            if (value === true && !el.hasAttribute(name)) return false;
            if (value === false || value == null) {
                if (el.hasAttribute(name)) return false;
            } else if (value !== true && el.getAttribute(name) !== String(value)) {
                return false;
            }
        }
        return true;
    }

    /** scopeId ổn định theo path (mọi instance + cả node <style> dùng chung). */
    private scopeIdFor(path: string, styles: StyleSpec[]): string {
        if (!styles.some(s => s.scoped)) return '';
        let id = this.scopeIds.get(path);
        if (!id) {
            id = this.hash(path);
            this.scopeIds.set(path, id);
        }
        return id;
    }

    /**
     * Prefix mỗi selector top-level bằng `[SCOPE_ATTR="id"]` (kiểu Vue scoped):
     *   `.foo .bar { … }` → `[data-sao-scope="x"] .foo .bar { … }`
     * Bỏ qua at-rule (@media/@keyframes…) ở mức selector — chỉ scope rule thường.
     */
    private scopeCss(css: string, scopeId: string): string {
        if (!scopeId) return css;
        const prefix = `[${SCOPE_ATTR}="${scopeId}"]`;
        // Tách theo block { … }; với mỗi rule, prefix phần selector trước '{'.
        return css.replace(/(^|})\s*([^{}@]+)\{/g, (_m, brace, selector) => {
            const scoped = selector
                .split(',')
                .map((s: string) => {
                    const t = s.trim();
                    return t ? `${prefix} ${t}` : t;
                })
                .join(', ');
            return `${brace} ${scoped} {`;
        });
    }

    /** Tag subtree của instance bằng scope attribute (cho descendant selector). */
    private tagScope(roots: Node[], scopeId: string): void {
        const visit = (node: Node) => {
            if (node.nodeType !== 1) return; // chỉ Element
            const el = node as HTMLElement;
            if (!el.hasAttribute(SCOPE_ATTR)) el.setAttribute(SCOPE_ATTR, scopeId);
            for (let i = 0; i < el.children.length; i++) visit(el.children[i]);
        };
        for (const r of roots) visit(r);
    }

    // ─── Script ─────────────────────────────────────────────────

    private createScriptNode(script: ScriptSpec): HTMLElement | null {
        const head = this.headEl;
        if (!head) return null;
        const el = document.createElement('script');
        if (script.type === 'src') {
            if (script.src) el.setAttribute('src', script.src);
        } else {
            el.textContent = script.content ?? '';
        }
        this.applyExtraAttrs(el, script);
        el.setAttribute(OWNER_ATTR, 'script');
        head.appendChild(el);
        return el;
    }

    // ─── Helpers ────────────────────────────────────────────────

    private applyExtraAttrs(el: HTMLElement, spec: StyleSpec | ScriptSpec): void {
        if (spec.id) el.setAttribute('id', spec.id);
        if (spec.className) el.setAttribute('class', spec.className);
        if (spec.attributes) {
            for (const [k, v] of Object.entries(spec.attributes)) {
                if (v === true) el.setAttribute(k, '');
                else if (v !== false && v != null) el.setAttribute(k, String(v));
            }
        }
    }

    /** JSON ổn định theo key để object attributes khác thứ tự vẫn cùng identity. */
    private stableSerialize(value: unknown): string {
        if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
        if (Array.isArray(value)) return `[${value.map(item => this.stableSerialize(item)).join(',')}]`;
        const object = value as Record<string, unknown>;
        return `{${Object.keys(object).sort().map((key) =>
            `${JSON.stringify(key)}:${this.stableSerialize(object[key])}`
        ).join(',')}}`;
    }

    /** Hash ngắn ổn định từ chuỗi (djb2) → dùng làm scopeId. */
    private hash(str: string): string {
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
        return h.toString(36).slice(0, 8);
    }
}

/** Singleton dùng chung toàn app (asset là tài nguyên global của document). */
const AssetManager = new AssetManagerService();
export default AssetManager;
