import type { HeadLinkOptions, HeadServiceInterface, HeadTagOptions } from "../contracts/HeadServiceInterface";
/**
 * HeadService — the single place that writes to `<head>` (title, meta, link,
 * JSON-LD). Independent of any View: callable from anywhere via `app('Head')`
 * / `App.Head`. Reuses whatever the server already rendered there (SSR's
 * `<title>`, `<meta name="description">`, ...) instead of creating
 * duplicates, and snapshots the pre-managed value so `resetPage()` can put it
 * back — the fix for tags leaking from one SPA-navigated page into the next.
 */
export declare class HeadServiceImpl implements HeadServiceInterface {
    private managed;
    setTitle(title: string, options?: HeadTagOptions): void;
    setMeta(name: string, content: string, options?: HeadTagOptions): void;
    setMetaProperty(property: string, content: string, options?: HeadTagOptions): void;
    setLink(rel: string, href: string, options?: HeadLinkOptions): void;
    setJsonLd(id: string, data: Record<string, any>, options?: HeadTagOptions): void;
    unset(key: string): void;
    resetPage(): void;
    /** Find-or-create an element by `identAttrs`, snapshot `valueAttr` once, then apply the new value. */
    private setAttrTag;
}
export declare const HeadService: HeadServiceImpl;
export default HeadService;
//# sourceMappingURL=HeadService.d.ts.map