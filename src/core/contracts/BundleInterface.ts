import type { ApplicationInterface } from "./ApplicationInterface.js";
import type { ServiceProviderInterface } from "./ServiceProviderInterface.js";

/** Factory view mà registry nhận: đồng bộ, hoặc lazy trả Promise<module>. */
export type ViewFactory = ((...args: any[]) => any) | (() => Promise<any>);

/**
 * Manifest của một bundle nạp rời (theme, gói mở rộng).
 *
 * Cùng MỘT hình dạng cho mọi loại bundle: file chỉ có view thì điền `views`,
 * file chỉ có code thì điền `providers`/`services`. Hai shape khác nhau = hai
 * nhánh loader = hai chỗ để lệch.
 */
export interface SaolaBundle {
    /** Định danh, dùng để báo lỗi và bắt trùng tên. */
    name?: string;
    /** Provider của bundle — class hoặc instance, đưa thẳng vào resolveProviderOrder. */
    providers?: any[];
    /** { Tên: Class | instance | object } → App.set(tên, …). */
    services?: Record<string, any>;
    /** { tên: fn } → gộp vào App.Helper. */
    helpers?: Record<string, any>;
    /** { 'dot.path': factory } → View.setViewRegistry(). Nạp sau ĐÈ nạp trước. */
    views?: Record<string, ViewFactory>;
    /** Chạy sau khi mọi bundle đã merge và App đã init. */
    boot?(app: ApplicationInterface): void;
}

/** Kết quả gộp nhiều bundle, theo đúng thứ tự mảng URL. */
export interface MergedBundles {
    providers: (ServiceProviderInterface | any)[];
    services: Record<string, any>;
    helpers: Record<string, any>;
    views: Record<string, ViewFactory>;
    boots: Array<(app: ApplicationInterface) => void>;
    /** Tên (hoặc URL) của bundle đã nạp được. */
    loaded: string[];
    /** [url, thông điệp lỗi] — nạp hỏng thì bỏ qua, KHÔNG làm sập boot. */
    failed: Array<[string, string]>;
}
