import type { HtmlInterface } from "../contracts/ElementInterface.js";
import type { SaoObjectType } from "../types/utils.js";
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
export interface FusedOutput {
    o: string;
    v: number;
    s?: string[];
    $t?: number;
}
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
interface Op {
    kind: number;
    t: number;
    name: string;
    v: number;
    keys: string[] | null;
    hash: string;
    mods: string[] | null;
}
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
export declare class FusedRow {
    private ctx;
    private desc;
    private suffix;
    private get;
    saoType: SaoObjectType;
    element: HTMLElement;
    parent: HtmlInterface | null;
    domChildren: Node[];
    __destroyed__: boolean;
    private plan;
    private nodes;
    private unsubscribe;
    /** `{viewId}-` — tiền tố của mọi id trên DOM. */
    private prefix;
    constructor(ctx: any, desc: FusedNode, id: string, suffix: string, parent: HtmlInterface | null, get: (index: number) => any);
    private create;
    /** Đi song song khuôn ↔ DOM server, ghi node của từng lỗ. false = lệch cấu trúc. */
    private claim;
    private apply;
    /** Dòng chạy lại (item mới hoặc state bị chụp đổi): ghi tại chỗ mọi giá trị theo item. */
    update(get: (index: number) => any): void;
    private refresh;
    /** Listener chung của mọi event trong dòng (đăng ký bằng chính object này). */
    handleEvent(event: Event): void;
    render(): HTMLElement;
    getElement(): HTMLElement;
    setParentElement(parent: HtmlInterface | null): void;
    setParent(parent: HtmlInterface | null): void;
    start(): void;
    stop(): void;
    destroy(): void;
    get isSaoElement(): boolean;
    get isOneHtml(): boolean;
}
export {};
//# sourceMappingURL=FusedRow.d.ts.map