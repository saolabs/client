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
import type { MergedBundles, SaolaBundle } from "../contracts/BundleInterface.js";
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
export declare function defineBundle(bundle: SaolaBundle): SaolaBundle;
/**
 * Gộp nhiều manifest theo ĐÚNG THỨ TỰ mảng — không theo thứ tự resolve của
 * mạng. Bundle sau ĐÈ bundle trước ở `views`/`services`/`helpers`; `providers`
 * thì CỘNG THÊM chứ không thay, để một bundle không gỡ được provider của app.
 */
export declare function mergeBundles(bundles: Array<SaolaBundle | null | undefined>): MergedBundles;
/**
 * Nạp danh sách URL bundle rồi gộp lại.
 *
 * Tải SONG SONG nhưng gộp theo thứ tự mảng — thứ tự URL là thứ tự ưu tiên do
 * server quyết định (`APP_CONFIGS.bundles`), không phải do mạng.
 *
 * Một URL hỏng KHÔNG làm sập boot: ghi vào `failed` rồi đi tiếp. Theme lỗi thì
 * site chạy bằng view gốc, còn hơn trắng trang.
 */
export declare function loadBundles(urls: string[] | null | undefined): Promise<MergedBundles>;
/** Chạy `boot()` của các bundle, sau khi App đã init. Lỗi một cái không chặn cái sau. */
export declare function bootBundles(merged: MergedBundles, app: ApplicationInterface): void;
//# sourceMappingURL=bundle.d.ts.map