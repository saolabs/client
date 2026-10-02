/**
 * HeadService — <head> tag management independent of any View. Callable from
 * anywhere (`app('Head')`); reuses whatever the server already rendered
 * instead of duplicating tags, and reverts page-scoped changes on demand.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HeadServiceImpl } from '../../src/core/services/HeadService';

let head: HeadServiceImpl;

beforeEach(() => {
    head = new HeadServiceImpl();
    document.head.innerHTML = ''; // innerHTML='' drops <title> too — clear first
    document.title = 'Original Title';
});

describe('HeadService — works with no View/ViewController involved', () => {
    it('sets title, meta, meta property, link and JSON-LD directly', () => {
        head.setTitle('My Page');
        head.setMeta('description', 'A great page');
        head.setMetaProperty('og:title', 'My Page OG');
        head.setLink('canonical', 'https://example.com/page');
        head.setJsonLd('product', { '@type': 'Product', name: 'Widget' });

        expect(document.title).toBe('My Page');
        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('A great page');
        expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('My Page OG');
        expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/page');
        const script = document.head.querySelector('script[data-head-id="product"]');
        expect(script?.getAttribute('type')).toBe('application/ld+json');
        expect(JSON.parse(script!.textContent!)).toEqual({ '@type': 'Product', name: 'Widget' });
    });

    it('reuses an existing SSR-rendered meta tag instead of duplicating it', () => {
        const existing = document.createElement('meta');
        existing.setAttribute('name', 'description');
        existing.setAttribute('content', 'server default');
        document.head.appendChild(existing);

        head.setMeta('description', 'client override');

        const all = document.head.querySelectorAll('meta[name="description"]');
        expect(all.length).toBe(1);
        expect(all[0]).toBe(existing);
        expect(all[0].getAttribute('content')).toBe('client override');
    });

    it('distinguishes multiple hreflang alternate links by their extra attrs', () => {
        head.setLink('alternate', '/en', { attrs: { hreflang: 'en' } });
        head.setLink('alternate', '/vi', { attrs: { hreflang: 'vi' } });

        const links = document.head.querySelectorAll('link[rel="alternate"]');
        expect(links.length).toBe(2);
        expect(document.head.querySelector('link[hreflang="en"]')?.getAttribute('href')).toBe('/en');
        expect(document.head.querySelector('link[hreflang="vi"]')?.getAttribute('href')).toBe('/vi');
    });
});

describe('HeadService — unset() / resetPage()', () => {
    it('adopts page-owned SSR JSON-LD without duplicates and removes it on navigation', () => {
        document.head.innerHTML = '<script type="application/ld+json" data-head-id="home" data-head-scope="page">{"@type":"WebSite","name":"Server"}</script>';
        const existing = document.head.querySelector('script');
        head.setJsonLd('home', { '@type': 'WebSite', name: 'Hydrated' });
        expect(document.head.querySelectorAll('script[type="application/ld+json"]').length).toBe(1);
        expect(document.head.querySelector('script')).toBe(existing);
        head.resetPage();
        expect(document.head.querySelector('script')).toBeNull();
        head.setJsonLd('home', { '@type': 'WebSite', name: 'Returned' });
        expect(JSON.parse(document.head.querySelector('script')!.textContent!).name).toBe('Returned');
    });

    it('preserves persistent SSR schema when a page override is reset', () => {
        document.head.innerHTML = '<script type="application/ld+json" data-head-id="brand">{"@type":"Organization","name":"Brand"}</script>';
        head.setJsonLd('brand', { '@type': 'Organization', name: 'Page override' });
        head.resetPage();
        expect(JSON.parse(document.head.querySelector('script')!.textContent!).name).toBe('Brand');
    });
    it('unset() removes a tag this service created', () => {
        head.setMeta('robots', 'noindex');
        expect(document.head.querySelector('meta[name="robots"]')).not.toBeNull();

        head.unset('meta:name:robots');
        expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    });

    it('unset() reverts to the pre-managed value for a tag that already existed', () => {
        const existing = document.createElement('meta');
        existing.setAttribute('name', 'description');
        existing.setAttribute('content', 'server default');
        document.head.appendChild(existing);

        head.setMeta('description', 'page override');
        head.unset('meta:name:description');

        expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('server default');
    });

    it('resetPage() reverts page-scoped tags but leaves persistent ones alone', () => {
        head.setTitle('Page A');
        head.setMeta('robots', 'index', { scope: 'persistent' });

        head.resetPage();

        expect(document.title).toBe('Original Title');
        expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index');
    });

    it('a second setTitle() before resetPage() does not overwrite the original snapshot', () => {
        head.setTitle('Page A');
        head.setTitle('Page A (updated)');
        head.resetPage();

        expect(document.title).toBe('Original Title');
    });
});
