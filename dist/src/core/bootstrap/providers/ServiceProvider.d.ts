import { ApplicationInterface } from "../../contracts/ApplicationInterface";
import { ServiceProviderInterface } from "../../contracts/utils";
import { SaoObjectType } from "../../types/utils";
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
export declare abstract class ServiceProvider implements ServiceProviderInterface {
    readonly saoType: SaoObjectType;
    abstract readonly name: string;
    readonly dependsOn?: string[];
    protected app: ApplicationInterface;
    constructor(application?: ApplicationInterface);
    initApplication(App?: ApplicationInterface): void;
    /** Override để đăng ký services vào container */
    register(): void;
    /** Override để init services sau khi tất cả providers đã register */
    boot(): void;
}
//# sourceMappingURL=ServiceProvider.d.ts.map