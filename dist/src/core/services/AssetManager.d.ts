/**
 * AssetManager — quản lý insert/remove `<style>` và `<script>` của component (View)
 * vào real DOM theo cơ chế **reference-counting**.
 *
 * Bối cảnh (Component = View — page/layout/super/nested đều là View):
 *   Mỗi `.sao` có thể khai báo `<style>` và `<script>` (không phải script
 *   `export default` — cái đó là method của component, do compiler gom vào
 *   userDefined). Các asset này phải có mặt trong real DOM khi có ÍT NHẤT một
 *   instance của component đang sống, và bị gỡ khi KHÔNG còn instance nào.
 *
 * Quy tắc (theo thiết kế):
 *   1. Ref-count theo (component path, asset). acquire() khi một instance vào
 *      real DOM (mount/resume); release() khi rời real DOM (pause/unmount/destroy).
 *   2. Insert đúng MỘT lần — khi ref 0 → 1. Các instance sau không insert lại.
 *   3. Remove khi ref 1 → 0 — instance khai báo đầu tiên bị gỡ nhưng nơi khác
 *      còn instance thì asset KHÔNG bị remove.
 *   4. View B bị pause (rời real DOM) → release → nếu về 0 thì remove; back lại
 *      view B → acquire → insert lại.
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
/** Attribute scope cho scoped style — value = scopeId của component path. */
export declare const SCOPE_ATTR = "data-sao-scope";
export declare class AssetManagerService {
    /** key = assetKey(path, kind, index) → record (ref-count + DOM node). */
    private records;
    /** path → scopeId ổn định (cache để mọi instance dùng chung). */
    private scopeIds;
    private get headEl();
    /**
     * Một instance của `path` vào real DOM → tăng ref các asset; insert khi 0→1.
     * @param subtreeRoots các node gốc của instance — dùng để tag scope cho scoped style.
     */
    acquire(path: string, styles?: StyleSpec[] | null, scripts?: ScriptSpec[] | null, subtreeRoots?: Node[] | null): void;
    /**
     * Một instance của `path` rời real DOM → giảm ref; remove khi 1→0.
     */
    release(path: string, styles?: StyleSpec[] | null, scripts?: ScriptSpec[] | null): void;
    /** Tổng số node asset đang trong DOM (test/debug). */
    activeCount(): number;
    /** Ref-count hiện tại của một asset (test/debug). */
    refCount(path: string, kind: 'sty' | 'sc', index: number): number;
    /** Dọn sạch — gỡ mọi node, reset (teardown app/test). */
    clear(): void;
    private acquireOne;
    private releaseOne;
    private key;
    private createStyleNode;
    /** scopeId ổn định theo path (mọi instance + cả node <style> dùng chung). */
    private scopeIdFor;
    /**
     * Prefix mỗi selector top-level bằng `[SCOPE_ATTR="id"]` (kiểu Vue scoped):
     *   `.foo .bar { … }` → `[data-sao-scope="x"] .foo .bar { … }`
     * Bỏ qua at-rule (@media/@keyframes…) ở mức selector — chỉ scope rule thường.
     */
    private scopeCss;
    /** Tag subtree của instance bằng scope attribute (cho descendant selector). */
    private tagScope;
    private createScriptNode;
    private applyExtraAttrs;
    /** Hash ngắn ổn định từ chuỗi (djb2) → dùng làm scopeId. */
    private hash;
}
/** Singleton dùng chung toàn app (asset là tài nguyên global của document). */
declare const AssetManager: AssetManagerService;
export default AssetManager;
//# sourceMappingURL=AssetManager.d.ts.map