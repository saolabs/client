/**
 * HeadService — the single place that writes to `<head>` (title, meta, link,
 * JSON-LD). Independent of any View: callable from anywhere via `app('Head')`
 * / `App.Head`. Reuses whatever the server already rendered there (SSR's
 * `<title>`, `<meta name="description">`, ...) instead of creating
 * duplicates, and snapshots the pre-managed value so `resetPage()` can put it
 * back — the fix for tags leaking from one SPA-navigated page into the next.
 */
export class HeadServiceImpl {
    constructor() {
        this.managed = new Map();
    }
    setTitle(title, options = {}) {
        if (typeof document === 'undefined')
            return;
        const key = '__title__';
        if (!this.managed.has(key)) {
            const original = document.title;
            this.managed.set(key, {
                scope: options.scope ?? 'page',
                revert: () => { document.title = original; },
            });
        }
        document.title = title;
    }
    setMeta(name, content, options = {}) {
        this.setAttrTag(`meta:name:${name}`, 'meta', { name }, 'content', content, options.scope ?? 'page');
    }
    setMetaProperty(property, content, options = {}) {
        this.setAttrTag(`meta:property:${property}`, 'meta', { property }, 'content', content, options.scope ?? 'page');
    }
    setLink(rel, href, options = {}) {
        const extra = options.attrs ?? {};
        const key = `link:${rel}` + Object.entries(extra).map(([k, v]) => `:${k}=${v}`).join('');
        this.setAttrTag(key, 'link', { rel, ...extra }, 'href', href, options.scope ?? 'page');
    }
    setJsonLd(id, data, options = {}) {
        if (typeof document === 'undefined')
            return;
        const key = `jsonld:${id}`;
        const selector = `script[data-head-id="${id}"]`;
        if (!this.managed.has(key)) {
            let el = document.head.querySelector(selector);
            const created = !el;
            if (!el) {
                el = document.createElement('script');
                el.type = 'application/ld+json';
                el.setAttribute('data-head-id', id);
                document.head.appendChild(el);
            }
            const originalText = created ? null : el.textContent;
            this.managed.set(key, {
                scope: options.scope ?? 'page',
                revert: () => {
                    const target = document.head.querySelector(selector);
                    if (!target)
                        return;
                    if (created)
                        target.remove();
                    else
                        target.textContent = originalText;
                },
            });
        }
        const el = document.head.querySelector(selector);
        if (el)
            el.textContent = JSON.stringify(data);
    }
    unset(key) {
        const entry = this.managed.get(key);
        if (!entry)
            return;
        entry.revert();
        this.managed.delete(key);
    }
    resetPage() {
        for (const [key, entry] of Array.from(this.managed)) {
            if (entry.scope !== 'page')
                continue;
            entry.revert();
            this.managed.delete(key);
        }
    }
    /** Find-or-create an element by `identAttrs`, snapshot `valueAttr` once, then apply the new value. */
    setAttrTag(key, tagName, identAttrs, valueAttr, value, scope) {
        if (typeof document === 'undefined')
            return;
        const selector = tagName + Object.entries(identAttrs).map(([k, v]) => `[${k}="${v}"]`).join('');
        if (!this.managed.has(key)) {
            let el = document.head.querySelector(selector);
            const created = !el;
            if (!el) {
                el = document.createElement(tagName);
                for (const [k, v] of Object.entries(identAttrs))
                    el.setAttribute(k, v);
                document.head.appendChild(el);
            }
            const originalValue = created ? null : el.getAttribute(valueAttr);
            this.managed.set(key, {
                scope,
                revert: () => {
                    const target = document.head.querySelector(selector);
                    if (!target)
                        return;
                    if (created)
                        target.remove();
                    else if (originalValue === null)
                        target.removeAttribute(valueAttr);
                    else
                        target.setAttribute(valueAttr, originalValue);
                },
            });
        }
        document.head.querySelector(selector)?.setAttribute(valueAttr, value);
    }
}
export const HeadService = new HeadServiceImpl();
export default HeadService;
//# sourceMappingURL=HeadService.js.map