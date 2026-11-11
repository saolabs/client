import { InitModes } from "../contracts/common.js";
import type { HtmlInterface } from "../contracts/ElementInterface.js";
import type { SaoObjectType } from "../types/utils.js";
import markerRegistry from "../services/MarkerRegistry.js";
import { Html, attrDomName, createDomElement, cssEscape } from "./Html.js";
import { isDiscarded } from "./teardown.js";

/**
 * FusedRow — "dòng gộp" của `@foreach`.
 *
 * Với thân vòng lặp đơn giản (chỉ element, chữ tĩnh, `{{ }}`, event, binding
 * class/attr/style) compiler không phát cây `this.html(...)` lồng nhau nữa mà
 * phát MỘT lời gọi cho mỗi phần tử gốc của dòng:
 *
 *     this.__fused(__fr1, `${row.id}`, parentElement, (__i) => { switch (__i) {
 *         case 0: return selected === row.id;     // binding class
 *         case 1: return row.label;               // {{ row.label }}
 *         case 2: return [{ handler: "pick", params: [row.id] }];   // @click
 *     } })
 *
 * `__fr1` là khuôn tĩnh (cây FusedNode) hoist một lần; `get(i)` trả giá trị
 * động thứ i của dòng. Cả dòng là MỘT object ở đây thay cho ~8 Html + 2 Output
 * + 6 TextElement: `cloneNode` khuôn, đi theo đường dẫn chỉ số con tới các "lỗ
 * động", ghi giá trị. Chạy lại với item mới thì ghi tại chỗ (có so sánh).
 *
 * DOM dựng ra phải giống đường thường (Html/Output) từng byte — kể cả thứ tự
 * attribute (class → attr → style, như Blade) và marker `s:o:…` quanh `{{ }}`.
 * Xem buildPlan: khuôn giữ sẵn chỗ cho attribute sẽ ghi theo từng dòng.
 *
 * Hydrate: gốc nhận lại theo class `{viewId}-{id}` như Html, phần con đi song
 * song khuôn ↔ DOM server. Lệch cấu trúc thì dựng lại dòng đó từ khuôn.
 */
export interface FusedOutput { o: string; v: number; s?: string[]; $t?: number }
export interface FusedNode {
    /** tag */ t: string;
    /** hash id (chưa có đuôi vòng lặp) */ i: string;
    /** attr tĩnh */ a?: Record<string, string | true>;
    /** class tĩnh, cách nhau dấu cách */ k?: string;
    /** binding attr: [tên, chỉ số giá trị, stateKeys] */ b?: [string, number, string[]][];
    /** binding class */ kb?: [string, number, string[]][];
    /** style theo thứ tự nguồn: [tên, "giá trị tĩnh"] hoặc [tên, chỉ số, stateKeys] */ y?: ([string, string] | [string, number, string[]])[];
    /** event: [tên, chỉ số giá trị, modifiers?] */ e?: [string, number, string[]?][];
    c?: (string | FusedNode | FusedOutput)[];
    $t?: number;
    $plan?: Plan;
}

const TEXT = 0, ATTR = 1, CLASS = 2, STYLE = 3, EVENT = 4, SET_CLASS = 5, STYLE_STATIC = 6;
const CREATE = 0, UPDATE = 1, HYDRATE = 2;

interface Op { kind: number; t: number; name: string; v: number; keys: string[] | null; hash: string; mods: string[] | null }

interface Plan {
    proto: Element;
    /** Đường dẫn chỉ số con từ gốc tới node đích của từng lỗ. */
    paths: number[][];
    ops: Op[];
    /** Op có giá trị theo item — ghi lại khi dòng chạy lại. */
    dyn: Op[];
    /** Op tự cập nhật theo state. */
    reactive: Op[];
    events: Op[];
    keys: string[];
}

function toggleClass(el: Element, name: string, force: boolean): void {
    if (name.includes(' ')) {
        for (const token of name.trim().split(/\s+/)) if (token && el.classList.contains(token) !== force) el.classList.toggle(token, force);
    } else if (el.classList.contains(name) !== force) el.classList.toggle(name, force);
}

function buildPlan(desc: FusedNode, parent: Element | null): Plan {
    const hydrateClass = Html.csrHydrateClass;
    const paths: number[][] = [], ops: Op[] = [], keys = new Set<string>();
    const op = (kind: number, t: number, name: string, v = -1, opKeys: string[] | null = null, hash = '', mods: string[] | null = null) =>
        ops.push({ kind, t, name, v, keys: opKeys && opKeys.length ? opKeys : null, hash, mods });
    const build = (n: FusedNode, parentDom: Element | null, path: number[]): Element => {
        const el = createDomElement(n.t, parentDom);
        n.$t = -1;
        const target = () => n.$t === -1 ? (n.$t = paths.push(path) - 1) : n.$t!;
        // Thứ tự dưới đây là thứ tự Html.initialize() và cũng là thứ tự Blade phát:
        // class → attr → style. Attribute giữ vị trí khi ghi đè, nên khuôn đặt sẵn
        // chỗ cho `class` (bật class hydrate) và cho binding attr; riêng style thì
        // từ binding đầu tiên trở đi phải ghi theo dòng để giữ thứ tự khai báo.
        const k = n.k || '';
        const hasClass = hydrateClass || k !== '';
        if (hasClass) el.setAttribute('class', k || 'x');
        if (hydrateClass) op(SET_CLASS, target(), k, -1, null, n.i);
        if (n.a) for (const name in n.a) el.setAttribute(attrDomName(name), String(n.a[name]));
        if (n.b) for (const [name, v, s] of n.b) {
            el.setAttribute(attrDomName(name), '');
            op(ATTR, target(), attrDomName(name), v, s);
        }
        // Chưa có attribute `class` mà có binding class: nó sinh ra lúc bật, trước style.
        let dirty = false;
        if (n.kb) for (const [name, v, s] of n.kb) { op(CLASS, target(), name, v, s); dirty = !hasClass; }
        if (n.y) for (const style of n.y) {
            if (style.length === 2) {
                if (dirty) op(STYLE_STATIC, target(), style[0], -1, null, style[1]);
                else el.style.setProperty(style[0], style[1]);
            } else { op(STYLE, target(), style[0], style[1], style[2]); dirty = true; }
        }
        if (n.e) for (const [name, v, mods] of n.e) op(EVENT, target(), name, v, null, '', mods && mods.length ? mods : null);
        let index = 0;
        if (n.c) for (const child of n.c) {
            if (typeof child === 'string') { el.appendChild(document.createTextNode(child)); index++; }
            else if ('o' in child) {
                // {{ }} = marker mở, text node, marker đóng — lỗ trỏ vào text node.
                el.appendChild(document.createComment(''));
                el.appendChild(document.createTextNode(''));
                el.appendChild(document.createComment(''));
                child.$t = paths.push(path.concat(index + 1)) - 1;
                op(TEXT, child.$t, '', child.v, child.s ?? null, child.o);
                index += 3;
            } else { el.appendChild(build(child, el, path.concat(index))); index++; }
        }
        return el;
    };
    const proto = build(desc, parent, []);
    for (const o of ops) if (o.keys) for (const key of o.keys) keys.add(key);
    return {
        proto, paths, ops,
        dyn: ops.filter(o => o.kind <= STYLE),
        reactive: ops.filter(o => o.keys !== null),
        events: ops.filter(o => o.kind === EVENT),
        keys: [...keys],
    };
}

export class FusedRow {
    saoType: SaoObjectType = 'Html';
    public element!: HTMLElement;
    public parent: HtmlInterface | null;
    public domChildren: Node[] = [];
    public __destroyed__ = false;
    private plan: Plan;
    private nodes!: Node[];
    private unsubscribe: (() => void) | null = null;
    /** `{viewId}-` — tiền tố của mọi id trên DOM. */
    private prefix: string;

    constructor(
        private ctx: any,
        private desc: FusedNode,
        id: string,
        private suffix: string,
        parent: HtmlInterface | null,
        private get: (index: number) => any,
    ) {
        this.parent = parent;
        this.prefix = ctx.viewId ? ctx.viewId + '-' : '';
        const plan = this.plan = desc.$plan ??= buildPlan(desc, parent?.element ?? null);
        let mode = CREATE;
        if (ctx.initMode === InitModes.HYDRATE) {
            const selector = `${desc.t}.${cssEscape(this.prefix + id)}`;
            const found = (parent?.element ?? document).querySelector(selector) as HTMLElement | null;
            const nodes = new Array<Node>(plan.paths.length);
            if (found && this.claim(desc, found, nodes)) {
                this.element = found;
                this.nodes = nodes;
                mode = HYDRATE;
            } else {
                this.create();
                // Server có dòng này nhưng cấu trúc lệch khuôn → thay bằng bản dựng ở client.
                found?.replaceWith(this.element);
            }
        } else this.create();
        const ops = plan.ops;
        for (let i = 0; i < ops.length; i++) this.apply(ops[i], mode);
        if (plan.keys.length) this.unsubscribe = ctx.states.__.subscribe(plan.keys, () => this.refresh());
    }

    private create(): void {
        const plan = this.plan, paths = plan.paths;
        const root = this.element = plan.proto.cloneNode(true) as HTMLElement;
        const nodes = this.nodes = new Array<Node>(paths.length);
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            let node: Node = root;
            for (let depth = 0; depth < path.length; depth++) {
                node = node.firstChild!;
                for (let step = path[depth]; step > 0; step--) node = node.nextSibling!;
            }
            nodes[i] = node;
        }
    }

    /** Đi song song khuôn ↔ DOM server, ghi node của từng lỗ. false = lệch cấu trúc. */
    private claim(n: FusedNode, el: Node, nodes: Node[]): boolean {
        if (el.nodeType !== 1 || (el as Element).localName !== n.t) return false;
        if (n.$t !== undefined && n.$t >= 0) nodes[n.$t] = el;
        let node: Node | null = el.firstChild;
        if (n.c) for (const child of n.c) {
            if (typeof child === 'string') {
                // Chữ tĩnh không có lỗ nào: có thì bước qua, thiếu (parser gộp/bỏ) thì thôi.
                if (node !== null && node.nodeType === 3) node = node.nextSibling;
            } else if ('o' in child) {
                const id = this.prefix + child.o + '-' + this.suffix;
                if (node === null || node.nodeType !== 8 || (node as Comment).data !== markerRegistry.openComment('output', id)) return false;
                let text: Node | null = node.nextSibling;
                let close: Node | null = text;
                if (text !== null && text.nodeType === 3) close = text.nextSibling; else text = null;
                if (close === null || close.nodeType !== 8 || (close as Comment).data !== markerRegistry.closeComment('output', id)) return false;
                // Giá trị rỗng: server không phát text node giữa hai marker.
                if (text === null) text = el.insertBefore(document.createTextNode(''), close);
                nodes[child.$t!] = text;
                node = close.nextSibling;
            } else {
                if (node === null || !this.claim(child, node, nodes)) return false;
                node = node.nextSibling;
            }
        }
        return true;
    }

    private apply(op: Op, mode: number): void {
        const node = this.nodes[op.t];
        switch (op.kind) {
            case TEXT: {
                if (mode === HYDRATE) return;   // giữ nguyên chữ của server, như Output
                const text = node as Text;
                if (mode === CREATE) {
                    const id = this.prefix + op.hash + '-' + this.suffix;
                    (text.previousSibling as Comment).data = markerRegistry.openComment('output', id);
                    (text.nextSibling as Comment).data = markerRegistry.closeComment('output', id);
                }
                const value = String(this.get(op.v) ?? '');
                if (text.data !== value) text.data = value;
                return;
            }
            case ATTR: {
                const el = node as Element, value = this.get(op.v);
                if (value !== undefined && value !== null && value !== false) {
                    if (el.getAttribute(op.name) !== String(value)) el.setAttribute(op.name, String(value));
                } else el.removeAttribute(op.name);
                return;
            }
            case CLASS:
                toggleClass(node as Element, op.name, !!this.get(op.v));
                return;
            case STYLE: {
                const style = (node as HTMLElement).style, value = String(this.get(op.v) ?? '');
                if (style.getPropertyValue(op.name) !== value) style.setProperty(op.name, value);
                return;
            }
            case EVENT:
                if (mode !== UPDATE) node.addEventListener(op.name, this, op.mods && op.mods.includes('once') ? { once: true } : undefined);
                return;
            case SET_CLASS:
                if (mode === CREATE) (node as Element).setAttribute('class',
                    this.prefix + op.hash + '-' + this.suffix + (op.name ? ' ' + op.name : ''));
                return;
            case STYLE_STATIC:
                if (mode === CREATE) (node as HTMLElement).style.setProperty(op.name, op.hash);
                return;
        }
    }

    /** Dòng chạy lại (item mới hoặc state bị chụp đổi): ghi tại chỗ mọi giá trị theo item. */
    update(get: (index: number) => any): void {
        if (this.__destroyed__) return;
        this.get = get;
        const dyn = this.plan.dyn;
        for (let i = 0; i < dyn.length; i++) this.apply(dyn[i], UPDATE);
    }

    private refresh(): void {
        if (this.__destroyed__) return;
        const reactive = this.plan.reactive;
        for (let i = 0; i < reactive.length; i++) this.apply(reactive[i], UPDATE);
    }

    /** Listener chung của mọi event trong dòng (đăng ký bằng chính object này). */
    handleEvent(event: Event): void {
        if (this.__destroyed__) return;
        const events = this.plan.events;
        for (let i = 0; i < events.length; i++) {
            const op = events[i];
            if (op.name !== event.type || this.nodes[op.t] !== event.currentTarget) continue;
            const mods = op.mods;
            if (mods) {
                // Cùng thứ tự với ViewController.wrapEventModifiers.
                if (mods.includes('self') && event.target !== event.currentTarget) return;
                if (mods.includes('prevent')) event.preventDefault();
                if (mods.includes('stop')) event.stopPropagation();
            }
            // Tham số handler tính LÚC event xảy ra — thân đã qua danh sách trắng của
            // compiler nên chỉ đọc item và state, luôn là giá trị hiện hành.
            this.ctx.invokeEventHandlers(this.get(op.v), event);
            return;
        }
    }

    render(): HTMLElement { return this.element; }
    getElement(): HTMLElement { return this.element; }
    setParentElement(parent: HtmlInterface | null): void { this.parent = parent; }
    setParent(parent: HtmlInterface | null): void { this.parent = parent; }
    start(): void {}
    stop(): void {}

    destroy(): void {
        if (this.__destroyed__) return;
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        this.unsubscribe?.();
        this.unsubscribe = null;
        if (!isDiscarded(this.element)) this.element.remove();
    }

    get isSaoElement(): boolean { return true; }
    get isOneHtml(): boolean { return true; }
}
