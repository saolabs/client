export interface TranslationConfig {
    locale?: string;
    fallbackLocale?: string;
    messages?: Record<string, { json?: Record<string, string>; groups?: Record<string, any> }>;
}

/** Synchronous lookup of dictionaries already present in the application bundle. */
export class TranslationService {
    locale = 'en';
    fallbackLocale = 'en';
    private messages: NonNullable<TranslationConfig['messages']> = {};

    init(config: TranslationConfig): void {
        this.locale = config.locale || 'en';
        this.fallbackLocale = config.fallbackLocale || 'en';
        this.messages = config.messages || {};
    }

    setLocale(locale: string): boolean {
        if (!Object.prototype.hasOwnProperty.call(this.messages, locale)) throw new Error(`Locale is not bundled: ${locale}`);
        if (locale === this.locale) return false;
        this.locale = locale;
        return true;
    }

    trans(key: string, replace: Record<string, any> = {}, locale = this.locale): string {
        const value = this.lookup(key, locale) ?? this.lookup(key, this.fallbackLocale) ?? key;
        return this.interpolate(value, replace);
    }

    choice(key: string, count: number, replace: Record<string, any> = {}, locale = this.locale): string {
        const local = this.lookup(key, locale);
        const value = local ?? this.lookup(key, this.fallbackLocale) ?? key;
        const pluralLocale = local === undefined ? this.fallbackLocale : locale;
        const options = value.split('|');
        let selected: string | undefined;
        for (const option of options) {
            const exact = option.match(/^\s*\{([^}]+)\}\s*(.*)$/s);
            if (exact && exact[1].split(',').some(n => Number(n.trim()) === count)) selected = exact[2];
            const range = option.match(/^\s*\[([^,]+),([^\]]+)\]\s*(.*)$/s);
            if (range) {
                const min = range[1].trim() === '*' ? -Infinity : Number(range[1]);
                const max = range[2].trim() === '*' ? Infinity : Number(range[2]);
                if (count >= min && count <= max) selected = range[3];
            }
            if (selected !== undefined) break;
        }
        if (selected === undefined) {
            const forms = options.filter(option => !/^\s*[\{\[]/.test(option));
            let index = 0;
            try {
                const rule = new Intl.PluralRules(pluralLocale.replace('_', '-'));
                const category = rule.select(count);
                const order = ['zero', 'one', 'two', 'few', 'many', 'other'];
                const categories = rule.resolvedOptions().pluralCategories;
                index = order.filter(c => categories.includes(c as Intl.LDMLPluralRule)).indexOf(category);
            } catch { index = count === 1 ? 0 : 1; }
            selected = forms[Math.min(Math.max(index, 0), forms.length - 1)] ?? options[0];
        }
        return this.interpolate(selected.trim(), { ...replace, count });
    }

    private lookup(key: string, locale: string): string | undefined {
        const catalog = this.messages[locale];
        if (!catalog) return undefined;
        if (catalog.json && Object.prototype.hasOwnProperty.call(catalog.json, key)) return catalog.json[key];
        const groups = catalog.groups || {};
        // Longest group match also supports package::group.item and nested group paths.
        const group = Object.keys(groups).filter(name => key.startsWith(name + '.')).sort((a, b) => b.length - a.length)[0];
        if (!group) return undefined;
        let value: any = groups[group];
        for (const part of key.slice(group.length + 1).split('.')) {
            if (!value || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
            value = value[part];
        }
        return typeof value === 'string' ? value : undefined;
    }

    private interpolate(value: string, replace: Record<string, any>): string {
        const keys = Object.keys(replace).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            const text = String(replace[key]);
            const variants: Record<string, string> = {
                [key]: text, [key.toUpperCase()]: text.toUpperCase(),
                [key.charAt(0).toUpperCase() + key.slice(1)]: text.charAt(0).toUpperCase() + text.slice(1),
            };
            for (const [name, content] of Object.entries(variants)) value = value.split(':' + name).join(content);
        }
        return value;
    }
}
