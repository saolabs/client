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
    /**
     * Khoá (service/helper/view) bundle này CỐ Ý thay của bundle trước. Chỉ có hiệu
     * lực ở chế độ strict và chỉ khi khoá nằm trong `overridable` của context.
     */
    overrides?: string[];
    /** `'theme'` = lớp trình bày, bị giới hạn khoá (xem MergeOptions.themeNamespaces). */
    kind?: 'theme' | 'package';
    /** Chạy sau khi mọi bundle đã merge và App đã init. */
    boot?(app: ApplicationInterface): void;
}

/**
 * Dạng khai service có factory: App gọi `factory(app)` khi đăng ký, nên mỗi
 * Application có instance RIÊNG (không dùng instance tạo ở phạm vi module).
 */
export interface ServiceFactory<T = any> {
    factory: (app: ApplicationInterface) => T;
}

/** Tuỳ chọn gộp bundle. Mặc định (không truyền) = hành vi cũ: sau đè trước, im lặng. */
export interface MergeOptions {
    /** Bật kiểm: trùng khoá, provider trùng tên, giới hạn khoá của theme. */
    strict?: boolean;
    /** Khoá được phép `overrides`; mục `A.B` phủ cả `A.B.x`. */
    overridable?: string[];
    /** Với bundle `kind: 'theme'`: tiền tố khoá services/helpers được phép. Thiếu = không cho khoá nào. */
    themeNamespaces?: string[];
    /** Ép mọi bundle trong lượt gộp là loại này (server quyết, bundle không tự nâng quyền được). */
    kind?: 'theme' | 'package';
    /** Trusted server classification by URL; bundle contents cannot promote a theme. */
    bundleKinds?: Record<string, 'theme' | 'package'>;
    /** Already registered source services/providers participate in strict collision checks. */
    initialBundle?: SaolaBundle;
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
