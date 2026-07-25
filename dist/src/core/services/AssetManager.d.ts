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
/** Attribute scope cho scoped style — value = scopeId của component path. */
export declare const SCOPE_ATTR = "data-sao-scope";
export declare class AssetManagerService {
    /** key = semantic asset identity → record (ref-count + DOM node). */
    private records;
    /** Legacy/debug lookup `(path, kind, index)` → semantic asset identity. */
    private leaseKeys;
    /** path → scopeId ổn định (cache để mọi instance dùng chung). */
    private scopeIds;
    private get headEl();
    /**
     * Một instance của `path` vào real DOM → tăng ref các asset; insert khi 0→1.
     * @param subtreeRoots các node gốc của instance — dùng để tag scope cho scoped style.
     */
    acquire(path: string, styles?: StyleSpec[] | null, scripts?: ScriptSpec[] | null, subtreeRoots?: Node[] | null): void;
    /**
     * Một instance của `path` rời real DOM → giảm ref; style/link remove khi 1→0.
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
    private leaseKey;
    /**
     * Global CSS/link dedup xuyên View. Scoped CSS phải giữ path trong key vì
     * cùng source nhưng mỗi View được rewrite bằng scopeId khác nhau.
     */
    private styleKey;
    /** Script là document-global side effect nên dedup xuyên View. */
    private scriptKey;
    private createStyleNode;
    /** Tìm stylesheet SSR cùng identity để hydration không tạo node trùng. */
    private findExistingStylesheet;
    private matchesExtraAttrs;
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
    /** JSON ổn định theo key để object attributes khác thứ tự vẫn cùng identity. */
    private stableSerialize;
    /** Hash ngắn ổn định từ chuỗi (djb2) → dùng làm scopeId. */
    private hash;
}
/** Singleton dùng chung toàn app (asset là tài nguyên global của document). */
declare const AssetManager: AssetManagerService;
export default AssetManager;
//# sourceMappingURL=AssetManager.d.ts.map