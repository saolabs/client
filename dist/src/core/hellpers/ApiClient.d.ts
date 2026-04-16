/**
 * API Module - V2 TypeScript
 * Centralized API service for backend communication
 */
import { APIClientInterface } from '../contracts/ApiInterface.js';
import { HttpService } from '../services/HttpService.js';
export interface APIEndpoints {
    system?: {
        config?: string;
        data?: string;
    };
    [key: string]: any;
}
export declare class ApiClient implements APIClientInterface {
    private http;
    private endpoints;
    constructor();
    /**
     * Setup default headers including CSRF token
     * @private
     */
    private setupDefaultHeaders;
    init(config: Record<string, any>): void;
    /**
     * Load API endpoints from config
     * @private
     */
    private loadEndpoints;
    /**
     * Get view data for specific URI
     * V1 compatible: returns response.data if status=true, else {}
     */
    getViewData(uri: string): Promise<any>;
    /**
     * Get system configuration
     * V1 compatible
     */
    getSystemConfig(): Promise<any>;
    /**
     * Get system data
     * V1 compatible
     */
    getSystemData(): Promise<any>;
    /**
     * Get data for current URI
     * Optimization: SSR-safe window access
     */
    getURIData(): Promise<any>;
    /**
     * Set custom endpoint
     */
    setEndpoint(key: string, value: string): void;
    /**
     * Get HTTP service instance for custom requests
     */
    getHttpService(): HttpService;
}
//# sourceMappingURL=ApiClient.d.ts.map