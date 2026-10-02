import { afterEach, expect, it, vi } from 'vitest';
import { ViewState } from '../../src/core/view/ViewState';
import { ResourceScope, type WatchContext } from '../../src/core/view/ResourceScope';
import { mountView, nextFrame, type Harness } from '../../src/testing';

let scope: ResourceScope, state: ViewState, harness: Harness | undefined;
afterEach(() => { scope?.destroy(); state?.__.destroy(); harness?.destroy(); harness = undefined; });
function create() {
    state = new ViewState(); state.__.register('id', 1);
    const queue = new Set<() => void>();
    const errors = vi.fn();
    scope = new ResourceScope(state.__, cb => { queue.add(cb); return () => { queue.delete(cb); }; }, errors);
    return { errors, drain() { for (const cb of [...queue]) if (queue.delete(cb)) cb(); } };
}

it('defers client side effects until activation, coalesces dependencies, and cleans up before rerun', () => {
    const { drain } = create();
    const calls: string[] = [];
    scope.watch(['id'], ({ id }, context) => {
        calls.push(`run:${id}`);
        context.onCleanup(() => calls.push(`cleanup:${id}`));
    });
    drain(); expect(calls).toEqual([]);
    scope.resume(); drain();
    state.id = 2; state.id = 3; state.__.flushNow();
    expect(calls).toEqual(['run:1', 'cleanup:1']);
    drain(); expect(calls).toEqual(['run:1', 'cleanup:1', 'run:3']);
    scope.pause(); expect(calls.at(-1)).toBe('cleanup:3');
    state.id = 4; state.__.flushNow(); drain();
    scope.resume(); drain(); expect(calls.at(-1)).toBe('run:4');
});

it('rejects stale commits synchronously before the next flush and disposes late async cleanups', async () => {
    const { drain } = create();
    const contexts: WatchContext[] = [];
    let resolve!: (cleanup: () => void) => void;
    const cleanup = vi.fn();
    scope.watch(['id'], (_, context) => {
        contexts.push(context);
        return new Promise<() => void>(r => { resolve = r; });
    });
    scope.resume(); drain();
    state.id = 2; // no flush yet
    expect(contexts[0].current).toBe(false);
    expect(contexts[0].commit(() => { throw new Error('stale write'); })).toBe(false);
    state.__.flushNow();
    expect(contexts[0].signal.aborted).toBe(true);
    resolve(cleanup); await Promise.resolve();
    expect(cleanup).toHaveBeenCalledTimes(1);
});

it('stop and destroy release resources once, suppress obsolete async errors, and honor immediate:false', async () => {
    const { drain, errors } = create();
    const dispose = vi.fn(); scope.defer(dispose);
    let reject!: (error: Error) => void;
    const run = vi.fn(() => new Promise<void>((_, r) => { reject = r; }));
    const stop = scope.watch(['id'], run, { immediate: false });
    scope.resume(); drain(); expect(run).not.toHaveBeenCalled();
    state.id = 2; state.__.flushNow(); drain(); expect(run).toHaveBeenCalledTimes(1);
    stop(); stop(); reject(new Error('obsolete')); await Promise.resolve();
    scope.destroy(); scope.destroy();
    expect(errors).not.toHaveBeenCalled(); expect(dispose).toHaveBeenCalledTimes(1);
});

it('View.watch reads patched text and list in the same DOM phase; cancelled callbacks never run', async () => {
    harness = mountView(function () {
        return this.wrapper(p => [this.html('root', 'div', p, {}, e => [
            this.output('value', e, true, ['count'], () => String(this.states.count)),
            this.reactive('if', 'if', null, e, ['count'], () => this.states.count ? [this.html('child', 'b', e, {}, () => [this.text('ready')])] : []),
        ])]);
    }, { states: { count: 0 } });
    const seen: string[] = [];
    harness.view.watch(['count'], () => { seen.push(harness!.text()); });
    harness.setState('count', 1);
    const cancelled = vi.fn(); harness.view.afterDom(cancelled)();
    harness.ctrl.states.__.flushNow();
    expect(seen).toEqual(['1ready']);
    expect(cancelled).not.toHaveBeenCalled();
    const order: number[] = [];
    harness.view.afterDom(() => { order.push(1); harness!.view.afterDom(() => order.push(2)); });
    harness.ctrl.flushReactiveUpdatesNow(); expect(order).toEqual([1]);
    await nextFrame(); expect(order).toEqual([1, 2]);
    harness.ctrl.pause(); harness.setState('count', 2);
    harness.ctrl.resume(); await nextFrame(); expect(seen.at(-1)).toBe('2ready');
});
