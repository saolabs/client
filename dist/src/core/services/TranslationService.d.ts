export interface TranslationConfig {
    locale?: string;
    fallbackLocale?: string;
    messages?: Record<string, {
        json?: Record<string, string>;
        groups?: Record<string, any>;
    }>;
}
/** Synchronous lookup of dictionaries already present in the application bundle. */
export declare class TranslationService {
    locale: string;
    fallbackLocale: string;
    private messages;
    init(config: TranslationConfig): void;
    setLocale(locale: string): boolean;
    trans(key: string, replace?: Record<string, any>, locale?: string): string;
    choice(key: string, count: number, replace?: Record<string, any>, locale?: string): string;
    private lookup;
    private interpolate;
}
//# sourceMappingURL=TranslationService.d.ts.map