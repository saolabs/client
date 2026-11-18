function encodeQueryPart(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function queryValue(value: unknown, key: string, parts: string[]): void {
    if (value == null) return;
    if (typeof value === 'object') {
        for (const [child, entry] of Object.entries(value)) {
            queryValue(entry, key + '[' + child + ']', parts);
        }
        return;
    }
    const scalar = typeof value === 'boolean' ? Number(value) : value;
    parts.push(encodeQueryPart(key) + '=' + encodeQueryPart(String(scalar)));
}

/** Laravel's path encoding and RFC 3986 query strings for named routes. */
export function hrefPath(pattern: string, params: Record<string, unknown>, missing: (param: string) => never): string {
    const used = new Set<string>();
    const path = pattern.replace(/\{([^{}?]+)(\?)?\}/g, (_match, key: string, optional?: string) => {
        used.add(key);
        const value = Object.prototype.hasOwnProperty.call(params, key) ? params[key] : null;
        if (value == null || value === '') return optional ? '' : missing(key);
        const scalar = typeof value === 'boolean' ? (value ? '1' : '') : String(value);
        return scalar.replace(/[%?#]/g, encodeQueryPart);
    });

    // Laravel encodes the whole path, then restores its allowed delimiters and pre-encoded bytes.
    const allowed = "/@:;,=+!*|?&#%";
    const encoded = encodeQueryPart(path.replace(/^\/+|\/+$/g, ''))
        .replace(/%[0-9A-F]{2}/g, byte => {
            const character = String.fromCharCode(parseInt(byte.slice(1), 16));
            return allowed.includes(character) ? character : byte;
        });
    const query: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (!used.has(key)) queryValue(value, key, query);
    }
    return '/' + encoded + (query.length ? '?' + query.join('&') : '');
}
