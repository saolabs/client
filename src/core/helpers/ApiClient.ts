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

export class ApiClient implements APIClientInterface {
    private http: HttpService;
    private endpoints: APIEndpoints;

    constructor() {
        this.http = new HttpService();
        this.setupDefaultHeaders();
        this.endpoints = this.loadEndpoints();
    }

    /**
     * Setup default headers including CSRF token
     * @private
     */
    private setupDefaultHeaders(): void {
        this.http.setHeader('Content-Type', 'application/json');
        this.http.setHeader('Accept', 'application/json');
        this.http.setHeader('X-Requested-With', 'XMLHttpRequest');
        this.http.setHeader('X-DATA-TYPE', 'json');

        // Get CSRF token from meta tag (SSR support)
        if (typeof document !== 'undefined') {
            const csrfToken = document.querySelector('meta[name="csrf-token"]');
            if (csrfToken) {
                const token = csrfToken.getAttribute('content');
                if (token) {
                    this.http.setHeader('X-CSRF-TOKEN', token);
                }
            }
        }
    }

    init(config: Record<string, any>): void {
        // Placeholder for any future initialization logic
    }

    /**
     * Load API endpoints from config
     * @private
     */
    private loadEndpoints(): APIEndpoints {
        if (typeof window === 'undefined') {
            return {};
        }
        return (window as any).ONE_CONFIGS?.api?.endpoints || {};
    }

    /**
     * Get view data for specific URI
     * V1 compatible: returns response.data if status=true, else {}
     */
    async getViewData(uri: string): Promise<any> {
        try {
            const response = await this.http.get(uri);
            return response.status ? response.data : {};
        } catch (error) {
            console.error('[API] Error getting view data:', error);
            return {};
        }
    }

    /**
     * Get system configuration
     * V1 compatible
     */
    async getSystemConfig(): Promise<any> {
        const endpoint = this.endpoints?.system?.config;
        if (!endpoint) {
            return {};
        }

        try {
            const response = await this.http.get(endpoint);
            return response.status ? response.data : {};
        } catch (error) {
            console.error('[API] Error getting system config:', error);
            return {};
        }
    }

    /**
     * Get system data
     * V1 compatible
     */
    async getSystemData(): Promise<any> {
        const endpoint = this.endpoints?.system?.data;
        if (!endpoint) {
            return {};
        }

        try {
            const response = await this.http.get(endpoint);
            return response.status ? response.data : {};
        } catch (error) {
            console.error('[API] Error getting system data:', error);
            return {};
        }
    }

    /**
     * Get data for current URI
     * Optimization: SSR-safe window access
     */
    async getURIData(): Promise<any> {
        if (typeof window === 'undefined') {
            return {};
        }

        const uri = window.location.pathname + window.location.search;
        return this.getViewData(uri);
    }

    /**
     * Set custom endpoint
     */
    setEndpoint(key: string, value: string): void {
        if (!this.endpoints[key]) {
            this.endpoints[key] = {};
        }
        Object.assign(this.endpoints[key], typeof value === 'string' ? { url: value } : value);
    }

    /**
     * Get HTTP service instance for custom requests
     */
    getHttpService(): HttpService {
        return this.http;
    }
}
