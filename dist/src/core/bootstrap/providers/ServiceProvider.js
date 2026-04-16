import { app } from "../../hellpers/app";
import { OOTEnum } from "../../types/utils";
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
export class ServiceProvider {
    constructor(application) {
        this.oneType = OOTEnum.SERVICE_PROVIDER;
        this.app = application ?? app();
        this.initApplication();
    }
    initApplication(App) {
        if (!this.app || typeof this.app !== 'object' || this.app.oneType !== OOTEnum.APPLICATION) {
            this.app = (App && App.oneType === OOTEnum.APPLICATION) ? App : app();
        }
    }
    /** Override để đăng ký services vào container */
    register() { }
    /** Override để init services sau khi tất cả providers đã register */
    boot() { }
}
//# sourceMappingURL=ServiceProvider.js.map