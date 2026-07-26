import { afterEach, describe, expect, it } from 'vitest';
import { Html } from '../../src/core/elements/Html';
import { View } from '../../src/core/view/View';

function makeContext(initialState: Record<string, any> = {}) {
    const view = new View('test.html-config-reconcile', 'view');
    const controller = view.__ctrl__;
    const state = controller.states.__ as any;

    for (const [key, value] of Object.entries(initialState)) {
        state.register(key, value);
    }

    return { controller, state };
}

const nextFlush = () => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

afterEach(() => {
    document.body.innerHTML = '';
});

describe('Html.updateConfig reconciliation', () => {
    it('removes stale managed DOM state and applies the new config without replacing the node', () => {
        const { controller } = makeContext();
        const html = new Html({
            ctx: controller,
            id: 'stable-node',
            tagName: 'button',
            config: {
                attrs: {
                    title: { type: 'static', value: 'old title' },
                    dataCount: { type: 'static', value: 1 },
                },
                classes: {
                    old: { type: 'static', value: true },
                },
                styles: {
                    color: { type: 'static', value: 'red' },
                },
                props: {
                    disabled: { type: 'static', value: true },
                },
            },
        });
        const element = html.element as HTMLButtonElement;

        html.updateConfig({
            attrs: {
                title: { type: 'static', value: 'new title' },
            },
            classes: [
                { type: 'static', value: 'new' },
            ],
            styles: {
                'background-color': { type: 'static', value: 'blue' },
            },
            props: {
                disabled: { type: 'static', value: false },
            },
        });

        expect(html.element).toBe(element);
        expect(element.classList.contains('stable-node')).toBe(true);
        expect(element.getAttribute('title')).toBe('new title');
        expect(element.hasAttribute('data-count')).toBe(false);
        expect(element.classList.contains('old')).toBe(false);
        expect(element.classList.contains('new')).toBe(true);
        expect(element.style.color).toBe('');
        expect(element.style.backgroundColor).toBe('blue');
        expect(element.disabled).toBe(false);

        html.destroy();
    });

    it('replaces event handlers idempotently and removes events omitted by the next config', () => {
        const { controller } = makeContext();
        let oldCalls = 0;
        let newCalls = 0;
        const oldHandler = () => { oldCalls++; };
        const newHandler = () => { newCalls++; };
        const html = new Html({
            ctx: controller,
            id: 'event-node',
            tagName: 'button',
            config: {
                events: { click: [oldHandler] },
            },
        });

        html.element.dispatchEvent(new Event('click'));
        expect(oldCalls).toBe(1);

        for (let i = 0; i < 25; i++) {
            html.updateConfig({ events: { click: [newHandler] } });
        }
        html.element.dispatchEvent(new Event('click'));
        expect(oldCalls).toBe(1);
        expect(newCalls).toBe(1);

        html.updateConfig({});
        html.element.dispatchEvent(new Event('click'));
        expect(newCalls).toBe(1);

        html.destroy();
    });

    it('unsubscribes old reactive bindings before installing new closures', async () => {
        const { controller, state } = makeContext({ first: 'A', second: 'B' });
        const html = new Html({
            ctx: controller,
            id: 'binding-node',
            tagName: 'div',
            config: {
                attrs: {
                    title: {
                        type: 'binding',
                        stateKeys: ['first'],
                        factory: () => state.getStateByKey('first'),
                    },
                },
            },
        });

        html.updateConfig({
            attrs: {
                title: {
                    type: 'binding',
                    stateKeys: ['second'],
                    factory: () => state.getStateByKey('second'),
                },
            },
        });
        expect(html.element.getAttribute('title')).toBe('B');

        state.setters.first('A2');
        await nextFlush();
        expect(html.element.getAttribute('title')).toBe('B');

        state.setters.second('B2');
        await nextFlush();
        expect(html.element.getAttribute('title')).toBe('B2');

        html.destroy();
    });

    it('keeps exactly one state subscription after repeated reuse', async () => {
        const { controller, state } = makeContext({ value: 'initial' });
        let factoryCalls = 0;
        const bindingConfig = () => ({
            attrs: {
                title: {
                    type: 'binding' as const,
                    stateKeys: ['value'],
                    factory: () => {
                        factoryCalls++;
                        return state.getStateByKey('value');
                    },
                },
            },
        });
        const html = new Html({
            ctx: controller,
            id: 'dedupe-binding-node',
            tagName: 'div',
            config: bindingConfig(),
        });

        for (let i = 0; i < 25; i++) {
            html.updateConfig(bindingConfig());
        }
        factoryCalls = 0;

        state.setters.value('updated');
        await nextFlush();

        expect(factoryCalls).toBe(1);
        expect(html.element.getAttribute('title')).toBe('updated');

        html.destroy();
    });

    it('rebinds two-way input handling without retaining the previous state key', async () => {
        const { controller, state } = makeContext({ first: 'left', second: 'right' });
        const bindConfig = (key: string) => ({
            attrs: {
                type: { type: 'static' as const, value: 'text' },
                bind: { type: 'static' as const, value: true },
                [key]: { type: 'static' as const, value: true },
            },
        });
        const html = new Html({
            ctx: controller,
            id: 'bind-node',
            tagName: 'input',
            config: bindConfig('first'),
        });
        const input = html.element as HTMLInputElement;

        html.updateConfig(bindConfig('second'));
        expect(input.value).toBe('right');

        input.value = 'changed';
        input.dispatchEvent(new Event('input'));
        expect(state.getStateByKey('first')).toBe('left');
        expect(state.getStateByKey('second')).toBe('changed');

        state.setters.first('stale');
        await nextFlush();
        expect(input.value).toBe('changed');

        state.setters.second('fresh');
        await nextFlush();
        expect(input.value).toBe('fresh');

        html.destroy();
    });

    it('destroy removes the latest events and invalidates every binding callback', async () => {
        const { controller, state } = makeContext({ value: 'before' });
        let calls = 0;
        const html = new Html({
            ctx: controller,
            id: 'destroy-node',
            tagName: 'button',
            config: {
                attrs: {
                    title: {
                        type: 'binding',
                        stateKeys: ['value'],
                        factory: () => state.getStateByKey('value'),
                    },
                },
                events: {
                    click: [() => { calls++; }],
                },
            },
        });
        const element = html.element;

        html.updateConfig({
            attrs: {
                title: {
                    type: 'binding',
                    stateKeys: ['value'],
                    factory: () => state.getStateByKey('value'),
                },
            },
            events: {
                click: [() => { calls += 10; }],
            },
        });
        html.destroy();

        element.dispatchEvent(new Event('click'));
        state.setters.value('after');
        await nextFlush();

        expect(calls).toBe(0);
        expect(element.getAttribute('title')).toBe('before');
    });
});
