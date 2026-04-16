import { Application } from "../app/Application";
/**
 * Container instance để quản lý services
 * Tương tự Laravel's app container
 */
const AppInstance = new Application();
/**
 * Helper function để lấy/đăng ký services
 * Cách dùng:
 * - app() - trả về container instance
 * - app('service_name') - lấy service
 * - app('key', value) - đăng ký instance
 *
 * @param key - Tên service (optional)
 * @param value - Giá trị service (optional)
 * @returns Container instance, service, hoặc void
 *
 * @example
 * // Lấy container
 * const container = app();
 * container.singleton('store', Store);
 *
 * // Lấy service trực tiếp
 * const store = app('store');
 *
 * // Đăng ký instance
 * app('config', { api: 'https://api.example.com' });
 */
const appFactory = (key, value) => {
    if (key === undefined || key === null) {
        // Không truyền gì → trả về container
        return AppInstance;
    }
    if (value !== undefined) {
        // Truyền 2 tham số → đăng ký instance
        AppInstance.instance(key, value);
        return;
    }
    // Truyền 1 tham số → lấy service
    return AppInstance.make(key);
};
// Add make method to app function for TypeScript compatibility
appFactory.make = (name) => AppInstance.make(name);
appFactory.instance = (name, value) => AppInstance.instance(name, value);
appFactory.resolve = (name, defaultValue) => AppInstance.resolve(name, defaultValue);
appFactory.register = (name, factory) => AppInstance.bind(name, factory);
appFactory.bind = (name, factory) => AppInstance.bind(name, factory);
appFactory.singleton = (name, factory) => AppInstance.singleton(name, factory);
appFactory.has = (name) => AppInstance.has(name);
appFactory.flush = () => { AppInstance.flush(); };
appFactory.destroy = () => { AppInstance.destroy(); };
export const app = appFactory;
//# sourceMappingURL=app.js.map