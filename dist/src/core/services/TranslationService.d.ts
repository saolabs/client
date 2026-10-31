export interface TranslationConfig {
    scope?: string;
    locale?: string;
    fallbackLocale?: string;
    messages?: Record<string, {
        json?: Record<string, string>;
        groups?: Record<string, any>;
    }>;
    /** Saola DB dictionaries. Kept separate from Laravel json/groups. */
    catalogs?: Record<string, LanguageSnapshot>;
}
export interface LanguageTree {
    [key: string]: string | LanguageTree;
}
export interface LanguageSnapshot {
    revision: number;
    messages: LanguageTree;
    scope?: string;
}
/** Synchronous lookup; snapshots may be supplied at bootstrap or installed at runtime. */
export declare class TranslationService {
    locale: string;
    fallbackLocale: string;
    private messages;
    private catalogs;
    private catalogScope?;
    getScope(): string | undefined;
    refresh(config: TranslationConfig): void;
    init(config: TranslationConfig): void;
    setLocale(locale: string): boolean;
    trans(key: string, replace?: Record<string, any>, locale?: string): string;
    text(key: string, replace?: Record<string, any>, defaultValue?: string | null, locale?: string): string;
    /** The catalogs this app holds, as the server reads them back: `<scope>;<locale>=<revision>;…` ('' while none is loaded). */
    held(): string;
    install(locale: string, snapshot: LanguageSnapshot): boolean;
    private lookupTree;
    choice(key: string, count: number, replace?: Record<string, any>, locale?: string): string;
    private lookup;
    private interpolate;
}
//# sourceMappingURL=TranslationService.d.ts.map