/**
 * Bundle nạp rời — hợp đồng + loader.
 *
 * Bài toán: một gói build ĐỘC LẬP (theme) phải cắm được view / service /
 * helper / provider vào app đang chạy, mà không chia sẻ module graph với app.
 * Cầu nối là import map: `@saolabs/client` của gói đó resolve về đúng file
 * entry của app, nên hai bên dùng CHUNG một instance runtime. Xem
 * docs/EXTENSION_ARCHITECTURE.md §7.
 */

import type { ApplicationInterface } from "../contracts/ApplicationInterface.js";
import type { MergeOptions, MergedBundles, SaolaBundle } from "../contracts/BundleInterface.js";
import logger from "../services/LoggerService.js";

/**
 * Khai báo một bundle. Chỉ là identity + kiểu — nó tồn tại để tên khoá là HỢP
 * ĐỒNG chứ không phải quy ước truyền miệng, và để IDE gợi ý được.
 *
 * @example
 * export default defineBundle({
 *     name: 'theme:aurora',
 *     views: { 'themes.aurora.modules.ping.index': factory },
 * });
 */
export function defineBundle(bundle: SaolaBundle): SaolaBundle {
    return bundle;
}

function emptyMerged(): MergedBundles {
    return { providers: [], services: {}, helpers: {}, views: {}, boots: [], loaded: [], failed: [] };
}

/** `A.B` phủ chính nó và `A.B.x`. */
function covered(list: string[] | undefined, key: string): boolean {
    return !!list?.some(p => key === p || key.startsWith(p + '.'));
}

/**
 * Lý do bundle bị từ chối ở chế độ strict, hoặc null nếu hợp lệ.
 * `owners` = khoá → tên bundle đã khai trước đó.
 */
function rejectReason(b: SaolaBundle, name: string, owners: Map<string, string>, o: MergeOptions, kind: string): string | null {
    if (kind === 'theme') {
        if (b.providers?.length) return `theme "${name}" không được khai providers`;
        for (const key of [...Object.keys(b.services ?? {}), ...Object.keys(b.helpers ?? {})]) {
            if (!covered(o.themeNamespaces, key)) return `theme "${name}" khai khoá "${key}" ngoài namespace trình bày cho phép`;
        }
    }
    for (const [group, map] of [['services', b.services], ['helpers', b.helpers], ['views', b.views]] as const) {
        for (const key of Object.keys(map ?? {})) {
            const id = `${group}:${key}`;
            const prev = owners.get(id);
            if (!prev) continue;
            // Override hợp lệ = bundle khai rõ VÀ context cho phép khoá đó.
            if (b.overrides?.includes(key) && covered(o.overridable, key)) continue;
            return `${group} "${key}" trùng giữa "${prev}" và "${name}" (không có overrides hợp lệ)`;
        }
    }
    return null;
}

/**
 * Gộp nhiều manifest theo ĐÚNG THỨ TỰ mảng — không theo thứ tự resolve của
 * mạng. Bundle sau ĐÈ bundle trước ở `views`/`services`/`helpers`; `providers`
 * thì CỘNG THÊM chứ không thay, để một bundle không gỡ được provider của app.
 *
 * `opts.strict` bật hàng rào của hợp đồng gói context: bundle trùng khoá không
 * có `overrides` hợp lệ, hoặc theme khai khoá ngoài phạm vi, bị BỎ NGUYÊN CẢ
 * BUNDLE và ghi vào `failed` (không làm sập boot). Provider trùng `name` bị bỏ.
 */
export function mergeBundles(bundles: Array<SaolaBundle | null | undefined>, opts: MergeOptions = {}): MergedBundles {
    const out = emptyMerged();
    const owners = new Map<string, string>();
    const providerNames = new Set<string>();

    for (const bundle of bundles) {
        if (!bundle || typeof bundle !== 'object') continue;
        const name = bundle.name ?? '(không tên)';

        if (opts.strict) {
            const kind = opts.kind ?? bundle.kind ?? 'package';
            const why = rejectReason(bundle, name, owners, opts, kind);
            if (why) {
                out.failed.push([name, why]);
                logger.error(`[Bundle] Bỏ bundle: ${why}`);
                continue;
            }
        }

        out.loaded.push(name);
        if (Array.isArray(bundle.providers)) {
            for (const p of bundle.providers) {
                const pn = p && typeof p === 'object' ? (p as any).name : undefined;
                if (opts.strict && typeof pn === 'string') {
                    if (providerNames.has(pn)) {
                        out.failed.push([name, `provider "${pn}" trùng tên, bỏ`]);
                        continue;
                    }
                    providerNames.add(pn);
                }
                out.providers.push(p);
            }
        }
        if (bundle.services) Object.assign(out.services, bundle.services);
        if (bundle.helpers) Object.assign(out.helpers, bundle.helpers);
        if (bundle.views) Object.assign(out.views, bundle.views);
        for (const [group, map] of [['services', bundle.services], ['helpers', bundle.helpers], ['views', bundle.views]] as const) {
            for (const key of Object.keys(map ?? {})) owners.set(`${group}:${key}`, name);
        }
        if (typeof bundle.boot === 'function') out.boots.push(bundle.boot.bind(bundle));
    }

    return out;
}

/**
 * Nạp danh sách URL bundle rồi gộp lại.
 *
 * Tải SONG SONG nhưng gộp theo thứ tự mảng — thứ tự URL là thứ tự ưu tiên do
 * server quyết định (`APP_CONFIGS.bundles`), không phải do mạng.
 *
 * Một URL hỏng KHÔNG làm sập boot: ghi vào `failed` rồi đi tiếp. Theme lỗi thì
 * site chạy bằng view gốc, còn hơn trắng trang.
 */
export async function loadBundles(urls: string[] | null | undefined, opts: MergeOptions = {}): Promise<MergedBundles> {
    if (!Array.isArray(urls) || urls.length === 0) return mergeBundles(opts.initialBundle ? [opts.initialBundle] : [], opts);

    const results = await Promise.all(urls.map(async (url): Promise<[string, SaolaBundle | null, string | null]> => {
        try {
            // URL đến từ runtime nên bundler không phân tích tĩnh được — đúng ý
            // đồ. Viết literal ở đây sẽ làm GÃY build của app (rollup cố resolve
            // một đường dẫn không có trong module graph).
            const mod: any = await import(/* @vite-ignore */ /* webpackIgnore: true */ url);
            // Bundle có thể khai manifest (export default) HOẶC tự đăng ký ngay
            // trong thân module qua App.View/App.set — import đã await xong nên
            // cả hai đều kịp trước khi render.
            return [url, (mod?.default ?? null) as SaolaBundle | null, null];
        } catch (err) {
            return [url, null, String(err)];
        }
    }));

    const classificationErrors: Array<[string, string]> = [];
    const classified = results.map(([url, bundle]) => {
        if (!bundle) return null;
        const kind = opts.bundleKinds?.[url];
        if (opts.strict && opts.bundleKinds && kind !== 'package' && kind !== 'theme') {
            classificationErrors.push([url, 'Missing trusted bundle kind from server']);
            return null;
        }
        return kind ? {...bundle, kind} : bundle;
    });
    const merged = mergeBundles([opts.initialBundle, ...classified], opts);
    for (const failure of classificationErrors) {
        merged.failed.push(failure);
        logger.error(`[Bundle] ${failure[1]}: ${failure[0]}`);
    }
    for (const [url, , error] of results) {
        if (error) {
            merged.failed.push([url, error]);
            logger.error(`[Bundle] Không nạp được "${url}": ${error}`);
        }
    }

    return merged;
}

/** Chạy `boot()` của các bundle, sau khi App đã init. Lỗi một cái không chặn cái sau. */
export function bootBundles(merged: MergedBundles, app: ApplicationInterface): void {
    for (const boot of merged.boots) {
        try {
            boot(app);
        } catch (err) {
            logger.error('[Bundle] boot() ném lỗi:', err);
        }
    }
}
