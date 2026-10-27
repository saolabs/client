import {afterEach, expect, it, vi} from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {app} from '../../src/core/helpers/app';
import {ViewManager} from '../../src/core/view/ViewManager';
import {HelperService} from '../../src/core/services/HelperService';
import {Router} from '../../src/core/routers/Router';
import MarkerRegistry from '../../src/core/services/MarkerRegistry';
import BlockManager from '../../src/core/services/BlockManager';
import {StoreService} from '../../src/core/services/StoreService';
import {AdminUI} from '../../../admin/resources/saola/admin/app/bundle';
import Host from '../fixtures/compiled/.generated/js/ui-host';
import UiPage from '../fixtures/compiled/.generated/js/ui-library-page';
import Shell from '../fixtures/compiled/.generated/js/material-admin-shell';

const base = 'admin.material.';
const modules = import.meta.glob('../fixtures/compiled/.generated/js/ui-*.ts', {eager: true}) as Record<string, {default: any}>;
const registry = Object.fromEntries(Object.entries(modules).filter(([file]) => !/ui-(host|library-page)\.ts$/.test(file))
    .map(([file, value]) => [base + 'components.ui.' + path.basename(file).replace(/^ui-/, '').replace(/\.ts$/, ''), value.default]));
let vm: ViewManager | undefined;
let router: Router | undefined;
afterEach(() => {
    router?.destroy(); router = undefined;
    vm?.destroy(); vm = undefined; BlockManager.destroy(); StoreService.instance('ViewManager').clear();
    document.body.innerHTML = ''; document.body.style.overflow = ''; vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
});
function environment() {
    const shared = app() as any; shared.set('Registry', MarkerRegistry);
    shared.set('Helper', new HelperService(shared)); shared.set('Admin', new AdminUI(shared));
    vm = new ViewManager(shared); shared.set('View', vm);
    return shared;
}
async function mount(kind: string, data: any, second?: any) {
    document.body.innerHTML = '<div id="app-root"></div>'; environment();
    vm!.init({container: '#app-root', systemData: {__base__: base}, registry: {'fixtures.ui-host': Host, ...registry}});
    await vm!.mountView('fixtures.ui-host', {kind, data, second: second ?? null}, {$urlPath: '/ui'} as any);
}
const items = [{id: 'a', label: 'First', text: '<b>Escaped text</b>'}, {id: 'b', label: 'Second', text: 'Second panel'}, {id: 'c', label: 'Disabled', disabled: true}];
const click = (selector: string) => (document.querySelector(selector) as HTMLButtonElement).click();

it('keeps template button variants, disabled/loading semantics, escaped labels and parent action forwarding', async () => {
    await mount('button', {label: '<b>Save</b>', action: 'save', variant: 'outline', color: 'success', rounded: true, icon: 'ri-save-line'}, {label: 'Busy', loading: true});
    const button = document.querySelector('#first-ui button')!;
    expect(button.classList.contains('btn-outline-success')).toBe(true); expect(button.classList.contains('rounded-pill')).toBe(true);
    expect(button.textContent).toContain('<b>Save</b>'); expect(button.querySelector('b')).toBeNull();
    expect(document.querySelector('#second-ui button')?.getAttribute('aria-busy')).toBe('true');
    expect((document.querySelector('#second-ui button') as HTMLButtonElement).disabled).toBe(true);
    click('#first-ui button'); await vi.waitFor(() => expect(document.querySelector('#ui-log')?.textContent).toBe('action:save'));
});

it('rejects executable links and emits card actions through nested components', async () => {
    await mount('card', {title: 'Example', text: 'Body', image: 'javascript:alert(1)', actionsInBody: true,
        actions: [{label: 'Edit', action: 'edit', href: 'javascript:alert(1)'}]});
    expect(document.querySelector('#first-ui img')).toBeNull(); expect(document.querySelector('#first-ui a')).toBeNull();
    click('#first-ui button'); await vi.waitFor(() => expect(document.querySelector('#ui-log')?.textContent).toBe('action:edit'));
});

it('keeps tab and accordion state per view, supports keyboard selection and ignores disabled choices', async () => {
    await mount('tabs', {id: 'tabs-one', active: 'a', items}, {id: 'tabs-two', active: 'a', items});
    const first = document.getElementById('tabs-one-tab-a')!; first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
    await vi.waitFor(() => expect(document.getElementById('tabs-one-tab-b')?.getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement?.id).toBe('tabs-one-tab-b');
    expect(document.getElementById('tabs-two-tab-a')?.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('#tabs-one-panel-a b')).toBeNull();
    vm!.destroy(); vm = undefined;
    await mount('accordion', {id: 'accordion-one', expanded: ['a'], items});
    click('#accordion-one-heading-b');
    await vi.waitFor(() => expect(document.getElementById('accordion-one-heading-a')?.getAttribute('aria-expanded')).toBe('false'));
    expect(document.getElementById('accordion-one-heading-b')?.getAttribute('aria-expanded')).toBe('true');
});

it('closes dropdowns with Escape/outside interaction and restores focus to the trigger', async () => {
    await mount('dropdown', {id: 'menu', label: 'Actions', items});
    click('#menu-trigger'); await vi.waitFor(() => expect(document.getElementById('menu-menu')).not.toBeNull());
    document.getElementById('menu-trigger')!.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await vi.waitFor(() => expect(document.getElementById('menu-menu')).toBeNull());
    expect(document.activeElement?.id).toBe('menu-trigger');
    click('#menu-trigger'); await vi.waitFor(() => expect(document.getElementById('menu-menu')).not.toBeNull());
    document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    await vi.waitFor(() => expect(document.getElementById('menu-menu')).toBeNull());
    click('#menu-trigger'); await vi.waitFor(() => expect(document.getElementById('menu-menu')).not.toBeNull());
    const outside = document.createElement('input'); document.body.appendChild(outside); outside.focus();
    await vi.waitFor(() => expect(document.getElementById('menu-menu')).toBeNull());
    expect(document.activeElement).toBe(outside);
});

it.each(['modal', 'drawer'])('%s traps focus, restores scroll/focus and releases listeners when destroyed', async variant => {
    document.body.style.overflow = 'auto';
    await mount('dialog', {id: 'overlay', label: 'Open', title: 'Dialog', text: 'Body', closeLabel: 'Close', variant});
    click('#overlay > button'); await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    await vi.waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('dialog'));
    expect(document.body.style.overflow).toBe('hidden');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}));
    expect(document.activeElement?.classList.contains('btn-close')).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    expect(document.body.style.overflow).toBe('auto'); expect(document.activeElement).toBe(document.querySelector('#overlay > button'));
    click('#overlay > button'); await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    vm!.destroy(); vm = undefined; expect(document.body.style.overflow).toBe('auto');
});

it('coordinates scroll locks for two dialogs without leaking a lock from a destroyed view', async () => {
    await mount('dialog', {id: 'one', label: 'One', title: 'One', closeLabel: 'Close'}, {id: 'two', label: 'Two', title: 'Two', closeLabel: 'Close'});
    click('#one > button'); click('#two > button'); await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2));
    click('#one .btn-close'); await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1));
    expect(document.body.style.overflow).toBe('hidden');
    vm!.destroy(); vm = undefined; expect(document.body.style.overflow).toBe('');
});

it('cancels toast timeouts on destroy and clamps progress values', async () => {
    await mount('toast', {id: 'notice', title: 'Title', text: 'Message', closeLabel: 'Close', timeout: 25});
    await vi.waitFor(() => expect(document.getElementById('notice')).toBeNull());
    vm!.destroy(); vm = undefined;
    await mount('progress', {value: 180, label: 'Progress', showValue: true});
    expect(document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
});

it('hydrates the actual Laravel catalogue with the same template components and no duplicate shell/cards', async () => {
    const root = path.join(__dirname, '../fixtures/compiled/.generated');
    const doc = new DOMParser().parseFromString(readFileSync(path.join(root, 'admin-ssr/public/ui-library.html'), 'utf8'), 'text/html');
    const script = [...doc.querySelectorAll('script')].find(node => node.textContent?.startsWith('window.APP_CONFIGS='))!.textContent!;
    const config = JSON.parse(script.replace('window.APP_CONFIGS=', '').replace(/;$/, ''));
    const ssr = JSON.parse(doc.querySelector('script[data-ref="saola-ssr"]')!.textContent!);
    document.body.innerHTML = doc.body.innerHTML;
    window.history.replaceState({}, '', '/control/_ui?locale=vi');
    const originalCard = document.querySelector('#ui-cards .card');
    const shared = environment(); shared.Helper.initTranslations(config.i18n);
    vm!.init({container: '#app-root', systemData: config.view.systemData, ssrData: config.view.ssrData, ssr, registry: {...registry,
        [base + 'pages.ui-library']: UiPage, [base + 'layouts.shell']: Shell}});
    router = new Router(shared); shared.set('Router', router); router.setViewManager(vm!); router.configure(config.router); router.start();
    await vi.waitFor(() => expect(vm!.getCurrentView()).not.toBeNull());
    expect(document.querySelectorAll('.saola-admin')).toHaveLength(1);
    expect(document.querySelectorAll('#ui-cards .card')).toHaveLength(4);
    expect(document.querySelector('#ui-cards .card')).toBe(originalCard);
    click('#ui-cards button'); await vi.waitFor(() => expect(document.querySelector('[role="status"]')?.textContent).toBe('submit'));
});

it('all compiled UI templates typecheck with the public App.Admin API', () => {
    const files = Object.keys(modules).map(file => path.resolve(__dirname, file));
    const program = ts.createProgram(files, {noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, baseUrl: path.join(__dirname, '../..'),
        paths: {'@saolabs/client': ['index.ts'], '@sao/admin/*': ['../admin/resources/saola/admin/*']}});
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});
