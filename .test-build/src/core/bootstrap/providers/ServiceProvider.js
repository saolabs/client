"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceProvider = void 0;
const app_1 = require("../../helpers/app");
const utils_1 = require("../../types/utils");
/**
 * Base class cho Service Provider — API giống Laravel.
 *
 * Subclass chỉ cần:
 * - Khai báo `name` và `dependsOn`
 * - Override `register()` để bind services (dùng `this.app`)
 * - Override `boot()` để init services sau khi tất cả đã register
 *
 * @example
 * class AuthServiceProvider extends ServiceProvider {
 *     readonly name = 'auth';
 *     readonly dependsOn = ['core', 'api'];
 *
 *     register() {
 *         this.app.set('Auth', new AuthService(this.app));
 *     }
 *
 *     boot() {
 *         this.app.get('Auth').loadUser();
 *     }
 * }
 */
class ServiceProvider {
    constructor(application) {
        this.saoType = utils_1.OOTEnum.SERVICE_PROVIDER;
        this.app = application ?? (0, app_1.app)();
        this.initApplication();
    }
    initApplication(App) {
        if (!this.app || typeof this.app !== 'object' || this.app.saoType !== utils_1.OOTEnum.APPLICATION) {
            this.app = (App && App.saoType === utils_1.OOTEnum.APPLICATION) ? App : (0, app_1.app)();
        }
    }
    /** Override để đăng ký services vào container */
    register() { }
    /** Override để init services sau khi tất cả providers đã register */
    boot() { }
}
exports.ServiceProvider = ServiceProvider;
