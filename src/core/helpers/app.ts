import { Application } from "../app/Application";
import { AppFactory, ServiceKey } from "../contracts/ApplicationInterface";


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
const appFactory = <T>(key?: ServiceKey, value?: any): Application | T | any | void => {
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
appFactory.make = <T>(name: ServiceKey): T => AppInstance.make(name);
appFactory.instance = <T>(name: ServiceKey, value: T): Application => AppInstance.instance(name, value);
appFactory.resolve = <T>(name: ServiceKey, defaultValue?: T): T => AppInstance.resolve(name, defaultValue);
appFactory.register = <T>(name: ServiceKey, factory: () => T): Application => AppInstance.bind(name, factory);
appFactory.bind = <T>(name: ServiceKey, factory: () => T): Application => AppInstance.bind(name, factory);
appFactory.singleton = <T>(name: ServiceKey, factory: () => T): Application => AppInstance.singleton(name, factory);
appFactory.has = (name: ServiceKey): boolean => AppInstance.has(name);
appFactory.flush = (): void => { AppInstance.flush(); };
appFactory.destroy = (): void => { AppInstance.destroy(); };
export const app = appFactory as AppFactory;
