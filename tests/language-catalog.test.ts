import { expect, it, vi } from 'vitest';
import { HelperService } from '../src/core/services/HelperService';

it('looks up arbitrary DB trees independently of Laravel dictionaries, preserving empty values', () => {
    const helper = new HelperService();
    helper.initTranslations({ locale: 'vi', fallbackLocale: 'en',
        messages: { vi: { json: { save: 'Laravel value' } } },
        catalogs: {
            en: { revision: 1, messages: { fallback: 'English', save: 'Save' } },
            vi: { revision: 2, messages: { save: '', auth: { 'keep-login': 'Nhớ tôi' }, welcome: ':name / :NAME / :Name' } },
        },
    });
    expect(helper.text('save')).toBe('');
    expect(helper.text('auth.keep-login')).toBe('Nhớ tôi');
    expect(helper.text('welcome', { name: 'lan' })).toBe('lan / LAN / Lan');
    expect(helper.text('fallback')).toBe('English');
    expect(helper.text('missing')).toBe('missing');
    expect(helper.text('missing', {}, '')).toBe('');
    expect(helper.text('missing', 'Default')).toBe('Default');
    expect(helper.__('save')).toBe('Laravel value');
});

it('loads a new locale at runtime and replaces snapshots without losing other locales', async () => {
    const helper = new HelperService();
    helper.initTranslations({ catalogs: { en: { revision: 1, messages: { save: 'Save', old: 'Old' } } } });
    await helper.loadLanguage('ja', async () => ({ revision: 1, messages: { save: '保存' } }));
    helper.setLocale('ja');
    expect(helper.text('save')).toBe('保存');
    expect(helper.installLanguage('en', { revision: 2, messages: { save: 'Save again' } })).toBe(true);
    helper.setLocale('en');
    expect(helper.text('old')).toBe('old');
    expect(helper.installLanguage('en', { revision: 1, messages: { save: 'Stale' } })).toBe(false);
    expect(helper.text('save')).toBe('Save again');
    expect(() => helper.installLanguage('en', { revision: 3, messages: JSON.parse('{"__proto__":{"polluted":"yes"}}') })).toThrow();
    expect(helper.text('save')).toBe('Save again');
});

it('interpolates once, so replacement values containing another placeholder remain text', () => {
    const helper = new HelperService();
    helper.initTranslations({ catalogs: { en: { revision: 1, messages: { label: ':name :other' } } } });
    expect(helper.text('label', { name: ':other', other: 'done' })).toBe(':other done');
});

it('isolates dictionaries by visibility scope and rejects a snapshot from another scope', () => {
    const helper = new HelperService();
    helper.initTranslations({ scope: 'web:abc', catalogs: { en: { scope: 'web:abc', revision: 1, messages: { save: 'Save' } } } });
    expect(helper.getLanguageScope()).toBe('web:abc');
    expect(() => helper.installLanguage('vi', { scope: 'admin:abc', revision: 100, messages: { secret: 'Hidden' } })).toThrow('scope differs');
    expect(helper.text('secret')).toBe('secret');
    expect(helper.text('save')).toBe('Save');
});

it('refreshes page-data revisions and fallback without resetting the selected locale', () => {
    const helper = new HelperService();
    const scope = 'web:abc';
    helper.initTranslations({scope, locale: 'vi', catalogs: {vi: {scope, revision: 1, messages: {save: 'Lưu'}}}});
    helper.applyLanguageConfig({scope, locale: 'en', fallbackLocale: 'ja', catalogs: {
        vi: {scope, revision: 2, messages: {save: 'Lưu mới'}}, ja: {scope, revision: 1, messages: {missing: '代替'}},
    }});
    expect(helper.getLocale()).toBe('vi');
    expect(helper.text('save')).toBe('Lưu mới');
    expect(helper.text('missing')).toBe('代替');
});

it('guards unsaved forms before loading and again before a language change can remount a page', async () => {
    const helper = new HelperService();
    helper.initTranslations({ catalogs: { en: { revision: 1, messages: { save: 'Save' } } } });
    const loader = vi.fn(async () => ({ revision: 1, messages: { save: 'Lưu' } }));
    expect(await helper.changeLanguage('vi', loader, () => false)).toBe(false);
    expect(loader).not.toHaveBeenCalled();
    let dirty = false;
    const duringLoad = async () => { dirty = true; return loader(); };
    expect(await helper.changeLanguage('vi', duringLoad, () => !dirty)).toBe(false);
    expect(helper.getLocale()).toBe('en');
    dirty = false;
    expect(await helper.changeLanguage('vi', loader, () => !dirty)).toBe(true);
    expect(helper.text('save')).toBe('Lưu');
});

it('only applies the latest requested language and cancels pending changes on context reset', async () => {
    const helper = new HelperService();
    helper.initTranslations({ catalogs: { en: { revision: 1, messages: { save: 'Save' } } } });
    let finish!: (value: any) => void;
    const slow = () => new Promise<any>(resolve => { finish = resolve; });
    const first = helper.changeLanguage('vi', slow);
    await Promise.resolve();
    expect(await helper.changeLanguage('ja', async () => ({ revision: 1, messages: { save: '保存' } }))).toBe(true);
    finish({ revision: 1, messages: { save: 'Lưu' } });
    expect(await first).toBe(false);
    expect(helper.getLocale()).toBe('ja');
    const pending = helper.changeLanguage('vi', slow);
    await Promise.resolve();
    helper.initTranslations({ locale: 'en', catalogs: { en: { revision: 1, messages: { save: 'New context' } } } });
    finish({ revision: 1, messages: { save: 'Lưu' } });
    expect(await pending).toBe(false);
    expect(helper.text('save')).toBe('New context');
});
