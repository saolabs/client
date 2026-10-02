import { afterEach, expect, it, vi } from 'vitest';
import { ViewState } from '../../src/core/view/ViewState';

let state: ViewState;
afterEach(() => { state?.__.destroy(); vi.restoreAllMocks(); });

it('notifies only dirty dependencies and calls multi-key records once per batch', () => {
    state = new ViewState();
    state.__.register('a', 0); state.__.register('b', 0);
    const unrelated = vi.fn();
    for (let i = 0; i < 1000; i++) state.on([`x${i}`, `y${i}`], unrelated);
    const seen = vi.fn();
    state.on(['a', 'b'], seen);
    state.a = 1; state.b = 2; state.__.flushNow();
    expect(seen).toHaveBeenCalledExactlyOnceWith({ a: 1, b: 2 });
    expect(unrelated).not.toHaveBeenCalled();
});

it('honors removal and snapshots registrations for every dirty key before callbacks', () => {
    state = new ViewState(); state.__.register('a', 0); state.__.register('b', 0);
    const seen: string[] = [];
    let off = () => {};
    state.on('a', () => {
        seen.push('a'); off();
        state.on(['a', 'b'], () => seen.push('late'));
    });
    off = state.on(['a', 'b'], () => seen.push('removed'));
    state.on('b', () => seen.push('b'));
    state.a = 1; state.b = 1; state.__.flushNow();
    expect(seen).toEqual(['a', 'b']);
    state.b = 2; state.__.flushNow();
    expect(seen).toEqual(['a', 'b', 'b', 'late']);
});

it('production flush does not inspect unrelated objects; same-reference setters remain explicit invalidation', () => {
    state = new ViewState(); state.__.setMutationDiagnostics(false);
    let reads = 0;
    const data: any = { get detail() { reads++; return 'value'; } };
    state.__.register('data', data); state.__.register('count', 0);
    reads = 0;
    for (let i = 1; i < 5; i++) { state.count = i; state.__.flushNow(); }
    expect(reads).toBe(0);
    const changed = vi.fn(); state.on('data', changed);
    data.extra = 1; state.data = data; state.__.flushNow();
    expect(changed).toHaveBeenCalledExactlyOnceWith(data);
});

it('frozen state is never cloned or scanned during unrelated updates, even with diagnostics enabled', () => {
    state = new ViewState(); state.__.setMutationDiagnostics(true);
    const large = Object.freeze(Array.from({ length: 50000 }, (_, i) => i));
    state.__.register('large', large); state.__.register('count', 0);
    const copy = vi.spyOn(Array.prototype, 'slice');
    state.count = 1; state.__.flushNow();
    expect(copy.mock.instances).not.toContain(large);
});
