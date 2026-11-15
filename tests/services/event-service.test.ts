import { expect, it } from 'vitest';
import { EventService } from '../../src/core/services/EventService';

it('dispatches matching subscriptions in order and consumes once before a recursive emit', () => {
    const events = new EventService();
    const seen: string[] = [];
    events.once('change', () => {
        seen.push('once');
        events.on('change', () => seen.push('late'));
        events.emit('change', 'nested');
    });
    events.on('change', value => seen.push(`single:${value}`));
    events.once(['change', 'other'], value => {
        seen.push(`multi-once:${value}`);
        events.emit('other', 'nested');
    });
    events.on(['change', 'other'], value => seen.push(`multi:${value}`));
    events.on(['unrelated', 'another'], () => seen.push('wrong event'));
    events.emit('change', 'outer');
    expect(seen).toEqual([
        'once', 'single:nested', 'late', 'multi-once:nested', 'multi:nested', 'multi:nested',
        'single:outer', 'multi:outer',
    ]);
    expect(events.listenerCount('other')).toBe(1);
});

it('removes a registration by handle and cleans every index for multi-event off', () => {
    const events = new EventService();
    let calls = 0;
    const listener = () => calls++;
    const off = events.on('save', listener);
    events.on('save', listener);
    events.on(['save', 'update'], listener);
    off();
    events.emit('save');
    expect(calls).toBe(2);
    events.off(['update'], listener);
    expect(events.eventNames()).toEqual(['save']);
    events.once({ save: listener });
    events.emit('save');
    events.emit('save');
    expect(calls).toBe(5);
});
