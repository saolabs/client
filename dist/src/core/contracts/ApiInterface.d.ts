import { HttpService } from '../services/HttpService.js';
export interface APIClientInterface {
    init(config: Record<string, any>): void;
    getViewData<T = any>(uri: string): Promise<T>;
    getSystemConfig<T = any>(): Promise<T>;
    getSystemData<T = any>(): Promise<T>;
    getURIData<T = any>(): Promise<T>;
    setEndpoint(key: string, value: string): void;
    getHttpService(): HttpService;
}
//# sourceMappingURL=ApiInterface.d.ts.map