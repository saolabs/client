// ─── Head Service Interface ───────────────────────────────────────

/**
 * `'page'` (default) — reverts to whatever was there before on the next
 * `resetPage()` (called once per SPA navigation), so a tag set by page A
 * never leaks into page B.
 * `'persistent'` — survives navigation (site-wide defaults, e.g. a global
 * robots directive or a fixed title suffix set once at boot).
 */
export type HeadTagScope = 'page' | 'persistent';

export interface HeadTagOptions {
    scope?: HeadTagScope;
}

export interface HeadLinkOptions extends HeadTagOptions {
    /** Extra attributes beyond rel/href — e.g. { hreflang: 'vi' } for alternate links. */
    attrs?: Record<string, string>;
}

/**
 * HeadService — manages `<head>` tags (title, meta, link, JSON-LD) directly
 * against `document`, independent of any View/ViewController. Registered in
 * the DI container as `App.Head` / `app('Head')` so any code — a view's
 * render, a route guard, an async data callback, app bootstrap — can call it.
 */
export interface HeadServiceInterface {
    setTitle(title: string, options?: HeadTagOptions): void;
    /** `<meta name="{name}" content="{content}">` — description, keywords, robots, viewport... */
    setMeta(name: string, content: string, options?: HeadTagOptions): void;
    /** `<meta property="{property}" content="{content}">` — Open Graph / Twitter card tags. */
    setMetaProperty(property: string, content: string, options?: HeadTagOptions): void;
    /** `<link rel="{rel}" href="{href}" ...attrs>` — canonical, alternate/hreflang, etc. */
    setLink(rel: string, href: string, options?: HeadLinkOptions): void;
    /** `<script type="application/ld+json">` — structured data, keyed by `id` (multiple blocks allowed). */
    setJsonLd(id: string, data: Record<string, any>, options?: HeadTagOptions): void;
    /** Revert one managed key immediately, regardless of its scope. */
    unset(key: string): void;
    /** Revert every `'page'`-scoped tag to its pre-managed state. Called once per navigation. */
    resetPage(): void;
}
