import { mount } from '../src/testing/index';
import View from './.cache/table.view.js';

const A = ['pretty','large','big','small','tall','short','long','handsome','plain','quaint','clean','elegant','easy','angry','crazy','helpful','mushy','odd','unsightly','adorable','important','inexpensive','cheap','expensive','fancy'];
const C = ['red','yellow','blue','green','pink','brown','purple','brown','white','black','orange'];
const N = ['table','chair','house','bbq','desk','car','pony','cookie','sandwich','burger','pizza','mouse','keyboard'];
let nextId = 1, seed = 1;
const rnd = (m: number) => (seed = (seed * 16807) % 2147483647) % m;
const build = (n: number) => Array.from({ length: n }, () => ({ id: nextId++, label: `${A[rnd(A.length)]} ${C[rnd(C.length)]} ${N[rnd(N.length)]}` }));

const h = mount(View as any);
const flush = () => { (h.ctrl as any).states.__.flushNow(); (h.ctrl as any).flushReactiveUpdatesNow(); };
let rows: any[] = [];
const set = (next: any[]) => { rows = next; (h.view as any).set(next); flush(); };
(window as any).fw = {
    name: 'saola',
    create: (n: number) => set(build(n)),
    replace: (n: number) => set(build(n)),
    update: () => set(rows.map((r, i) => i % 10 === 0 ? { ...r, label: r.label + ' !!!' } : r)),
    select: () => { (h.view as any).select(rows[1].id); flush(); },
    swap: () => { const a = rows.slice(); const t = a[1]; a[1] = a[a.length - 2]; a[a.length - 2] = t; set(a); },
    remove: () => set(rows.filter((_, i) => i !== 5)),
    append: (n: number) => set(rows.concat(build(n))),
    clear: () => set([]),
    count: () => document.querySelectorAll('tbody tr').length,
};
