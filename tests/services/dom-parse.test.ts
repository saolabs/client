import { expect, it } from 'vitest';
import { DomService } from '../../src/core/services/DomService';

it('returns independent nodes across repeated parses', () => {
    const dom = new DomService();
    const first = dom.parse('<p>Hello</p>text<!--end-->');
    expect(first).toHaveLength(3);
    expect(first[0].textContent).toBe('Hello');
    document.body.append(...first);
    const next = dom.parse('<b>Next</b>');
    expect(next).toHaveLength(1);
    expect(first[0].isConnected).toBe(true);
    for (const node of first) node.parentNode?.removeChild(node);
});
