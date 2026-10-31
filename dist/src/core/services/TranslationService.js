/** Synchronous lookup; snapshots may be supplied at bootstrap or installed at runtime. */
export class TranslationService {
    constructor() {
        this.locale = 'en';
        this.fallbackLocale = 'en';
        this.messages = {};
        this.catalogs = {};
    }
    getScope() { return this.catalogScope; }
    refresh(config) {
        if (config.scope !== this.catalogScope)
            throw new Error('Language snapshot scope differs from the active catalog');
        for (const [locale, snapshot] of Object.entries(config.catalogs || {}))
            this.install(locale, snapshot);
        if (config.fallbackLocale)
            this.fallbackLocale = config.fallbackLocale;
    }
    init(config) {
        this.catalogScope = config.scope;
        this.locale = config.locale || 'en';
        this.fallbackLocale = config.fallbackLocale || 'en';
        this.messages = config.messages || {};
        this.catalogs = {};
        for (const [locale, snapshot] of Object.entries(config.catalogs || {}))
            this.install(locale, snapshot);
    }
    setLocale(locale) {
        if (!Object.prototype.hasOwnProperty.call(this.messages, locale) && !Object.prototype.hasOwnProperty.call(this.catalogs, locale))
            throw new Error(`Locale is not loaded: ${locale}`);
        if (locale === this.locale)
            return false;
        this.locale = locale;
        return true;
    }
    trans(key, replace = {}, locale = this.locale) {
        const value = this.lookup(key, locale) ?? this.lookup(key, this.fallbackLocale) ?? key;
        return this.interpolate(value, replace);
    }
    text(key, replace = {}, defaultValue = null, locale = this.locale) {
        const value = this.lookupTree(this.catalogs[locale]?.messages, key)
            ?? this.lookupTree(this.catalogs[this.fallbackLocale]?.messages, key) ?? defaultValue ?? key;
        return this.interpolate(value, replace);
    }
    /** The catalogs this app holds, as the server reads them back: `<scope>;<locale>=<revision>;…` ('' while none is loaded). */
    held() {
        const parts = Object.entries(this.catalogs).map(([locale, snapshot]) => `${locale}=${snapshot.revision}`);
        return this.catalogScope && parts.length ? [this.catalogScope, ...parts].join(';') : '';
    }
    install(locale, snapshot) {
        if (snapshot.scope !== this.catalogScope)
            throw new Error('Language snapshot scope differs from the active catalog');
        if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0)
            throw new Error('Invalid language revision');
        const validate = (value, depth = 0) => {
            if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 32)
                throw new Error('Invalid language tree');
            const copy = Object.create(null);
            for (const [key, child] of Object.entries(value)) {
                if (!key || key.includes('.') || /\s/u.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key))
                    throw new Error('Invalid language key');
                copy[key] = typeof child === 'string' ? child : validate(child, depth + 1);
            }
            return copy;
        };
        const messages = validate(snapshot.messages);
        if (this.catalogs[locale] && this.catalogs[locale].revision > snapshot.revision)
            return false;
        // Replace, rather than deep merge: removed keys must disappear.
        this.catalogs = { ...this.catalogs, [locale]: { revision: snapshot.revision, messages, scope: snapshot.scope } };
        return true;
    }
    lookupTree(tree, key) {
        let value = tree;
        for (const part of key.split('.')) {
            if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part))
                return undefined;
            value = value[part];
        }
        return typeof value === 'string' ? value : undefined;
    }
    choice(key, count, replace = {}, locale = this.locale) {
        const local = this.lookup(key, locale);
        const value = local ?? this.lookup(key, this.fallbackLocale) ?? key;
        const pluralLocale = local === undefined ? this.fallbackLocale : locale;
        const options = value.split('|');
        let selected;
        for (const option of options) {
            const exact = option.match(/^\s*\{([^}]+)\}\s*(.*)$/s);
            if (exact && exact[1].split(',').some(n => Number(n.trim()) === count))
                selected = exact[2];
            const range = option.match(/^\s*\[([^,]+),([^\]]+)\]\s*(.*)$/s);
            if (range) {
                const min = range[1].trim() === '*' ? -Infinity : Number(range[1]);
                const max = range[2].trim() === '*' ? Infinity : Number(range[2]);
                if (count >= min && count <= max)
                    selected = range[3];
            }
            if (selected !== undefined)
                break;
        }
        if (selected === undefined) {
            const forms = options.filter(option => !/^\s*[\{\[]/.test(option));
            let index = 0;
            try {
                const rule = new Intl.PluralRules(pluralLocale.replace('_', '-'));
                const category = rule.select(count);
                const order = ['zero', 'one', 'two', 'few', 'many', 'other'];
                const categories = rule.resolvedOptions().pluralCategories;
                index = order.filter(c => categories.includes(c)).indexOf(category);
            }
            catch {
                index = count === 1 ? 0 : 1;
            }
            selected = forms[Math.min(Math.max(index, 0), forms.length - 1)] ?? options[0];
        }
        return this.interpolate(selected.trim(), { ...replace, count });
    }
    lookup(key, locale) {
        const catalog = this.messages[locale];
        if (!catalog)
            return undefined;
        if (catalog.json && Object.prototype.hasOwnProperty.call(catalog.json, key))
            return catalog.json[key];
        const groups = catalog.groups || {};
        // Longest group match also supports package::group.item and nested group paths.
        const group = Object.keys(groups).filter(name => key.startsWith(name + '.')).sort((a, b) => b.length - a.length)[0];
        if (!group)
            return undefined;
        let value = groups[group];
        for (const part of key.slice(group.length + 1).split('.')) {
            if (!value || !Object.prototype.hasOwnProperty.call(value, part))
                return undefined;
            value = value[part];
        }
        return typeof value === 'string' ? value : undefined;
    }
    interpolate(value, replace) {
        const parameters = Object.create(null);
        const keys = Object.keys(replace).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            const text = String(replace[key]);
            const variants = {
                [key]: text, [key.toUpperCase()]: text.toUpperCase(),
                [key.charAt(0).toUpperCase() + key.slice(1)]: text.charAt(0).toUpperCase() + text.slice(1),
            };
            // Build substitutions first; inserted text must never be interpolated again.
            Object.assign(parameters, Object.fromEntries(Object.entries(variants).map(([name, content]) => [':' + name, content])));
        }
        const names = Object.keys(parameters).sort((a, b) => b.length - a.length);
        if (!names.length)
            return value;
        const pattern = new RegExp(names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
        return value.replace(pattern, match => parameters[match]);
    }
}
//# sourceMappingURL=TranslationService.js.map