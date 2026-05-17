import { ApplicationInterface } from "../../contracts/ApplicationInterface";
import { ServiceProviderInterface } from "../../contracts/utils";
import { app } from "../../helpers/app";
import { SaoObjectType, OOTEnum } from "../../types/utils";
import { NamedServiceProvider } from "./provider-order";

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
export abstract class ServiceProvider implements ServiceProviderInterface {
    readonly saoType: SaoObjectType = OOTEnum.SERVICE_PROVIDER;
    abstract readonly name: string;
    readonly dependsOn?: string[];
    protected app: ApplicationInterface;

    constructor(application?: ApplicationInterface) {
        this.app = application ?? app<ApplicationInterface>();
        this.initApplication();
    }

    initApplication(App?: ApplicationInterface): void {
        if (!this.app || typeof this.app !== 'object' || this.app.saoType !== OOTEnum.APPLICATION) {
            this.app = (App && App.saoType === OOTEnum.APPLICATION) ? App : app<ApplicationInterface>();
        }
    }

    /** Override để đăng ký services vào container */
    register(): void {}

    /** Override để init services sau khi tất cả providers đã register */
    boot(): void {}
}
