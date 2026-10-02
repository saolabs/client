import { SaoObjectType } from "../types/utils.js";
import type { ApplicationInterface } from "./ApplicationInterface.js";
/** Service Provider — register() đăng ký, boot() khởi động */
export interface ServiceProviderInterface {
    saoType?: SaoObjectType;
    name: string;
    dependsOn?: string[];
    initApplication?(App?: ApplicationInterface): void;
    register(): void;
    boot?(): void;
}
//# sourceMappingURL=ServiceProviderInterface.d.ts.map