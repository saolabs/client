import { OneObjectType } from "../types/utils";
import type { ApplicationInterface } from "./ApplicationInterface";
/** Service Provider — register() đăng ký, boot() khởi động */
export interface ServiceProviderInterface {
    oneType?: OneObjectType;
    name: string;
    dependsOn?: string[];
    initApplication?(App?: ApplicationInterface): void;
    register(): void;
    boot?(): void;
}
//# sourceMappingURL=ServiceProviderInterface.d.ts.map