import { reconcileChildren, reuseStaticText, removeUnmanagedNodes } from './reconcileChildren.js';
import { InitModes } from "../contracts/common.js";
import { hydrateElementList } from "../helpers/view.js";
import { TextElement } from "./TextElement.js";
import SectionManager from "../services/SectionManager.js";
import { runEnter, runLeave } from "../helpers/transition.js";
import { discarding, isDiscarded } from "./teardown.js";
/**
 * Escape một chuỗi để dùng làm CSS class/id selector. Class hydrate dạng
 * "{viewId}-{id}" có viewId là hex (uniqid) CÓ THỂ bắt đầu bằng chữ số, làm
 * ".6a3a..." trở thành selector không hợp lệ → querySelector ném SyntaxError.
 * Dùng CSS.escape khi có; fallback escape thủ công ký tự đầu là số + ký tự đặc biệt.
 */
export function cssEscape(value) {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    if (g.CSS && typeof g.CSS.escape === 'function') {
        return g.CSS.escape(value);
    }
    // Fallback tối thiểu: escape chữ số đầu (\3N ) và ký tự không phải [-_a-zA-Z0-9].
    return value
        .replace(/^[0-9]/, ch => `\\3${ch} `)
        .replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`);
}
const SVG_NS = 'http://www.w3.org/2000/svg';
/**
 * `document.createElement('svg')` ra HTMLUnknownElement — SVG dựng bằng CSR
 * không vẽ gì. Phải dùng createElementNS.
 *
 * Chỉ cần nhận ra `<svg>`: mọi thứ bên trong kế thừa namespace từ cha, kể cả
 * tag không liệt kê được hết (`filter`, cả họ `fe*`, `textPath`…). Danh sách
 * tag SVG là thừa và luôn thiếu.
 *
 * `foreignObject` CẮT chuỗi kế thừa: con của nó là HTML thật (đó là toàn bộ lý
 * do nó tồn tại), parser của trình duyệt cũng làm đúng như vậy khi đọc markup
 * SSR — không cắt ở đây thì SSR và CSR ra hai cây khác nhau.
 *
 * Tên tag phải giữ đúng hoa/thường: createElementNS KHÔNG có bảng điều chỉnh
 * như parser HTML, `'clippath'` ra SVGElement trơ. Compiler đã trả về đúng
 * `clipPath` (xem Parser::SVG_TAG_ADJUST).
 */
export function createDomElement(tagName, parent) {
    const isSvg = tagName === 'svg'
        || (parent?.namespaceURI === SVG_NS && parent.tagName !== 'foreignObject');
    return isSvg
        ? document.createElementNS(SVG_NS, tagName)
        : document.createElement(tagName);
}
/** SVG phân biệt hoa thường — hạ chữ thường sẽ hỏng `clipPath`, `feGaussianBlur`… */
function domTagName(el) {
    return el.namespaceURI === SVG_NS ? el.tagName : el.tagName.toLowerCase();
}
const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
/** `dataCount` → `data-count`; kết quả nhớ lại vì mỗi tên được hỏi hàng nghìn lần. */
const ATTR_NAME_CACHE = new Map();
export function attrDomName(name) {
    let normalized = ATTR_NAME_CACHE.get(name);
    if (normalized === undefined) {
        normalized = /^(?:data|aria)[A-Z]/.test(name)
            ? name.slice(0, 4) + '-' + name[4].toLowerCase() + name.slice(5).replace(/[A-Z]/g, m => '-' + m.toLowerCase())
            : name;
        ATTR_NAME_CACHE.set(name, normalized);
    }
    return normalized;
}
/** Chỉ để thoả HtmlInterface — không ai ghi vào. */
const NO_NODES = Object.freeze([]);
const NO_CHILDREN = Object.freeze([]);
/** Tên DOM mà một bucket config quản lý — chỉ dựng khi updateConfig cần so. */
function configKeys(bucket, normalize) {
    let names = null;
    if (bucket)
        for (const key in bucket)
            (names ?? (names = new Set())).add(normalize ? normalize(key) : key);
    return names;
}
function configClassNames(classes, dynamic) {
    let names = dynamic ? new Set(dynamic) : null;
    if (Array.isArray(classes)) {
        for (const item of classes) {
            if (item && item.type !== 'dynamic' && item.value)
                (names ?? (names = new Set())).add(item.value);
        }
    }
    else if (classes) {
        for (const key in classes)
            (names ?? (names = new Set())).add(key);
    }
    return names;
}
function hasOwnKeys(value) {
    if (value)
        for (const _ in value)
            return true;
    return false;
}
export class Html {
    constructor({ ctx, id = null, parentElement = null, tagName = 'div', element = null, config = {}, childrenFactory = null, initMode = InitModes.CREATE, }) {
        this.saoType = 'Html';
        this.children = NO_CHILDREN;
        this.domChildren = NO_NODES; // For compatibility with HtmlInterface; Html itself doesn't have a single root element
        this.childrenFactory = null;
        /**
         * Chỉ `@bind` cần signal. Tạo sẵn cho MỌI element (và tạo lại ở mỗi
         * updateConfig) từng chiếm ~30% thời gian một lượt cập nhật danh sách.
         */
        this.abortController = null;
        /** Config NGUYÊN BẢN compiler truyền vào — so identity để bỏ qua cập nhật thừa. */
        this.sourceConfig = null;
        this.isVoidTag = false;
        /** Khác null = element vừa tạo ở client, class tĩnh chờ ghi một lần. */
        this.pendingClass = null;
        this.isOptionTag = false;
        this.isTextareaTag = false;
        /** All state subscriptions for reactive bindings — cleanup on destroy */
        this.bindingUnsubscribes = null;
        /** Invalidates deferred/stale binding callbacks after a config reconciliation. */
        this.bindingGeneration = 0;
        this.contentUnsubscribe = null;
        /**
         * Tên class do binding `dynamic` gắn lúc chạy — thứ duy nhất không suy ra
         * được từ config. Attr/class/style/prop còn lại đọc thẳng từ config khi
         * updateConfig cần gỡ phần thừa, nên element vừa tạo không tốn Set nào.
         */
        this.dynamicClassNames = null;
        /** Events actually registered through ViewController, independent of current config. */
        this.registeredEventNames = null;
        this.initMode = InitModes.CREATE;
        this.adoptedSSR = false;
        /** Registry của dòng @foreach nơi element này được tạo; factory con chạy trong phạm vi đó. */
        this.scope = null;
        /** Element lấy từ bản sao của khuôn dòng — con của nó cũng nằm sẵn trong đó. */
        this.fromClone = false;
        /** Chỉ bật trong constructor của element nhân bản: phần tĩnh đã có trên DOM. */
        this.skipStatic = false;
        /** Đã dựng xong trước khi gắn vào trang; lượt render() kế tiếp của vòng lặp bỏ qua. */
        this.prerendered = false;
        /** Lượt nhận node con từ bản sao đã chạy (chỉ một lần). */
        this.cloneBuilt = false;
        this.contentRendered = false;
        this.bindingInitialized = false;
        this.composing = false;
        this.isStarted = false;
        /** Đã chạy enter rồi — re-render không được chạy lại. */
        this._entered = false;
        /** Registry guard — element đã destroy không được reuse (xem RUNTIME_CONTRACT.md §2) */
        this.__destroyed__ = false;
        this.ctx = ctx;
        this.parent = parentElement;
        this.config = config;
        this.sourceConfig = config;
        this.tagName = tagName;
        this.initMode = initMode;
        // ── Ưu tiên element trực tiếp (ViewManager rootElement / test) ─────────
        // config.element hoặc tham số element cho phép caller truyền HTMLElement sẵn có
        // mà không cần lookup DOM.
        const directElement = element instanceof HTMLElement
            ? element
            : (config.element instanceof HTMLElement ? config.element : null);
        // ── Class hydrate = "{viewId}-{id}" ────────────────────────────────────
        // Blade emit `$__VIEW_ID__ . '-' . $id` cho MỌI element, nên CSR phải gắn
        // đúng class đó. Trước đây nhánh create dùng id THÔ ('e1') → cùng một view
        // render bởi server và bởi client ra hai DOM khác nhau, và mọi element CSR
        // dùng chung vài chục tên class ('e1', 'e13'...) trên toàn tài liệu.
        const viewId = ctx.viewId ?? null;
        const hydrateClass = id ? (viewId ? `${viewId}-${id}` : id) : null;
        if (directElement) {
            this.element = directElement;
            this.tagName = domTagName(this.element);
            this.adoptedSSR = initMode === InitModes.HYDRATE;
        }
        else if (initMode === InitModes.HYDRATE) {
            // ── SSR Hydration: claim server-rendered DOM node bằng class ID ──────
            //
            // Blade compiler emit class: $__VIEW_ID__ . '-{id}' (e.g. "v12345-af0882bc-0-1").
            // Tham chiếu: COMPILER_CONTRACT.md §hydration, docs/FOREACH_RECONCILIATION_DESIGN.md
            //
            // Thuật toán (top-down):
            //   1. Tìm trong parentElement.element trước (để tránh cross-view collision)
            //   2. Fallback: document.querySelector nếu không có parentElement
            //   3. Không tìm thấy → tạo element mới (partial hydration)
            let found = null;
            if (hydrateClass) {
                // viewId (server uniqid) là hex CÓ THỂ bắt đầu bằng chữ số → class
                // "6a3a...-32a9c14a" làm selector ".6a3a..." KHÔNG hợp lệ
                // (querySelector ném SyntaxError). CSS.escape() escape ký tự đầu.
                const selector = `${tagName}.${cssEscape(hydrateClass)}`;
                const searchScope = parentElement?.element ?? null;
                if (searchScope) {
                    // CÓ parent → chỉ tìm trong đó. KHÔNG hạ xuống quét cả tài
                    // liệu: element không nằm dưới parent của nó thì cái tìm
                    // thấy ở nơi khác là của cây khác — claim vào rồi mount sẽ
                    // BỨNG node đó khỏi chỗ đúng, hỏng cả hai cây, không một
                    // tiếng động. Server không render vùng này thì đường đúng là
                    // partial hydration: tạo element mới ở dưới.
                    found = searchScope.querySelector(selector);
                }
                else {
                    // Không có parent để giới hạn (element cấp gốc) — chỉ khi ấy
                    // quét cả tài liệu mới là cách duy nhất.
                    found = document.querySelector(selector);
                }
            }
            if (found) {
                this.element = found;
                this.tagName = domTagName(found);
                this.adoptedSSR = true;
            }
            else {
                // Partial hydration fallback: element không có trong SSR output
                this.element = createDomElement(tagName, parentElement?.element);
                if (hydrateClass)
                    this.element.classList.add(hydrateClass);
            }
        }
        else {
            // ── CSR (create mode): tạo element mới ───────────────────────────────
            // KHÔNG gắn class hydrate: nó chỉ để claim DOM do server render, mà
            // element tạo ở client không ai claim. Mỗi element một tên class
            // duy nhất từng là ~1/3 thời gian tạo một danh sách dài. Hệ quả:
            // DOM của CSR khác SSR đúng ở class `{viewId}-{id}` này.
            // Class tĩnh vẫn ghi MỘT lần trong initializeClasses().
            // Nhân bản khuôn: gốc của dòng lấy một bản sao cả cây từ khuôn của
            // vòng lặp; element con nhận lại node có sẵn trong cây đó (xem render()).
            const vc = ctx;
            let ready = null;
            if (vc._rowProto) {
                const proto = vc._rowProto[vc._rowProtoIndex++];
                if (proto !== undefined && proto.localName === tagName)
                    ready = proto.cloneNode(true);
            }
            else if (vc._adoptActive) {
                const node = vc._adoptCursor;
                if (node !== null && node.nodeType === 1 && node.localName === tagName) {
                    ready = node;
                    vc._adoptCursor = node.nextSibling;
                }
                else
                    vc._adoptOk = false;
            }
            if (ready !== null) {
                this.element = ready;
                this.fromClone = true;
                // Attr/class TĨNH đã có sẵn trên bản sao; chỉ class hydrate (bật
                // riêng cho kiểm thử) là khác theo từng dòng.
                this.pendingClass = Html.csrHydrateClass && hydrateClass ? hydrateClass : null;
            }
            else {
                this.element = createDomElement(this.tagName, parentElement?.element);
                this.pendingClass = Html.csrHydrateClass && hydrateClass ? hydrateClass : '';
            }
        }
        const lowerTag = this.tagName.toLowerCase();
        this.isVoidTag = VOID_TAGS.has(lowerTag);
        this.isOptionTag = lowerTag === 'option';
        this.isTextareaTag = lowerTag === 'textarea';
        this.childrenFactory = childrenFactory;
        this.skipStatic = this.fromClone;
        this.initialize();
        this.skipStatic = false;
    }
    updateConfig(newConfig) {
        if (this.__destroyed__)
            return;
        // Compiler hoist config TĨNH (không factory/event) thành hằng dùng chung
        // cho mọi lượt render, nên cùng một object nghĩa là không có gì để làm.
        // Config rỗng `{}` cũng vậy dù mỗi lần là một object mới.
        const previousSource = this.sourceConfig;
        if (newConfig === previousSource)
            return;
        this.sourceConfig = newConfig;
        if (!hasOwnKeys(newConfig) && !hasOwnKeys(previousSource))
            return;
        // Reuse must behave like a fresh initialization without replacing the DOM
        // node: remove every resource owned by the previous config first, then make
        // the new managed sections authoritative. This prevents stale attrs,
        // duplicate events, and state subscriptions retaining old closures.
        //
        // Event giữ nguyên listener gốc: ViewController thay danh sách handler
        // tại chỗ, nên chỉ gỡ những event KHÔNG còn trong config mới.
        this.removeEventListeners(newConfig.events);
        this.cleanupBindingResources();
        // Bảy mục dưới đây luôn do config mới quyết định; các khoá khác
        // (transition, eventModifiers, element) giữ giá trị cũ nếu config mới
        // không nhắc tới. Config cũ không có khoá nào loại đó thì dùng thẳng
        // config mới, khỏi cấp phát bản gộp cho mỗi element ở mỗi lượt render.
        const old = this.config;
        this.config = old.transition === undefined && old.eventModifiers === undefined && old.element === undefined
            ? newConfig
            : {
                ...old,
                ...newConfig,
                attrs: newConfig.attrs,
                props: newConfig.props,
                events: newConfig.events,
                classes: newConfig.classes,
                styles: newConfig.styles,
                bind: newConfig.bind,
                content: newConfig.content,
            };
        // initialize() ghi lại chính xác những gì config mới quản lý; phần còn
        // sót trong tập cũ là thứ phải gỡ. Làm theo thứ tự này thì không cần
        // dựng riêng một bộ Set "config mới có gì" chỉ để so.
        const oldDynamic = this.dynamicClassNames;
        this.dynamicClassNames = null;
        this.initialize();
        this.removeStaleDomState(old, oldDynamic);
    }
    initialize() {
        // Element vừa tạo: `class` ghi TRƯỚC attr — đúng thứ tự Blade phát
        // (@class → @attr → @style), nếu không DOM của CSR lệch SSR ở thứ tự
        // attribute. Riêng khi `class` đi qua attrs thì giữ thứ tự cũ (nối thêm).
        const early = this.pendingClass !== null && !(this.config.attrs && 'class' in this.config.attrs);
        if (early)
            this.writePendingClass();
        this.initializeAttributes();
        this.initializeClasses(early);
        this.initializeStyles();
        this.initializeEvents();
    }
    isBindingCurrent(generation) {
        return !this.__destroyed__ && generation === this.bindingGeneration;
    }
    cleanupBindingResources() {
        this.bindingGeneration++;
        this.contentUnsubscribe?.();
        this.contentUnsubscribe = null;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        if (!this.bindingUnsubscribes)
            return;
        for (const unsubscribe of this.bindingUnsubscribes) {
            try {
                unsubscribe();
            }
            catch (error) {
                console.error('[Html] Failed to unsubscribe a reactive binding:', error);
            }
        }
        this.bindingUnsubscribes = null;
    }
    /** Gỡ khỏi DOM những gì config CŨ quản lý mà config mới không còn nhắc tới. */
    removeStaleDomState(old, oldDynamic) {
        const now = this.config;
        const normalize = (name) => this.normalizeAttrName(name);
        const attrs = configKeys(old.attrs, normalize);
        if (attrs) {
            const kept = configKeys(now.attrs, normalize);
            for (const name of attrs)
                if (!kept?.has(name))
                    this.element.removeAttribute(name);
        }
        const classes = configClassNames(old.classes, oldDynamic);
        if (classes) {
            const kept = configClassNames(now.classes, this.dynamicClassNames);
            for (const name of classes)
                if (!kept?.has(name))
                    this.removeClass(name);
        }
        if (old.styles)
            for (const name in old.styles) {
                if (!now.styles || !(name in now.styles))
                    this.element.style.removeProperty(name);
            }
        if (!old.props)
            return;
        let defaults = null;
        const target = this.element;
        for (const propName in old.props) {
            if (now.props && propName in now.props)
                continue;
            defaults ?? (defaults = createDomElement(this.tagName, this.parent?.element));
            try {
                if (propName in defaults) {
                    target[propName] = defaults[propName];
                }
                else {
                    delete target[propName];
                }
            }
            catch {
                // Some host properties are readonly. Removing an own property is
                // still safe and avoids retaining user/config objects where possible.
                try {
                    delete target[propName];
                }
                catch { /* no-op */ }
            }
        }
    }
    /**
     * Chuẩn hóa tên attr từ camelCase → kebab-case cho data-* và aria-* attrs.
     *
     * Compiler emit camelCase: "dataCount" → client phải set "data-count" trên DOM.
     * Tham chiếu: COMPILER_CONTRACT.md §3 — camelCase attrs.
     *
     * @example normalizeAttrName('dataCount') === 'data-count'
     * @example normalizeAttrName('ariaLabel') === 'aria-label'
     * @example normalizeAttrName('id') === 'id'  (không đổi)
     */
    normalizeAttrName(name) {
        return attrDomName(name);
    }
    /**
     * Thiết lập two-way data binding (v-model-like) theo compiler pattern:
     *
     *   config.bind = { key: "<stateKey>" }  — own bucket, sibling of attrs/props/events.
     *
     * Hành vi:
     *   1. Khởi tạo: set element.value = state hiện tại
     *   2. input event → update state
     *   3. state change → update element.value
     *
     * Tham chiếu: COMPILER_CONTRACT.md §5 — @bind directive.
     */
    setupTwoWayBinding(stateKey) {
        const manager = this.ctx.states.__;
        const el = this.element;
        const generation = this.bindingGeneration;
        const isSelect = el.tagName === 'SELECT';
        const isMultiple = isSelect && el.multiple;
        const isCheckbox = el.type === 'checkbox';
        const isRadio = el.type === 'radio';
        const isNumber = el.type === 'number' || el.type === 'range';
        const readValue = () => {
            if (isMultiple)
                return Array.from(el.selectedOptions).map(option => option.value);
            if (isCheckbox)
                return el.checked;
            if (isNumber)
                return Number.isNaN(el.valueAsNumber) ? el.value : el.valueAsNumber;
            return el.value;
        };
        const commitInput = () => {
            if (!this.isBindingCurrent(generation) || (isRadio && !el.checked))
                return;
            const setter = manager.setters[stateKey];
            if (typeof setter === 'function')
                setter(readValue());
            else
                manager.updateStateByKey(stateKey, readValue());
        };
        const applyState = (value) => {
            if (!this.isBindingCurrent(generation) || this.composing)
                return;
            if (isMultiple) {
                const selected = new Set(Array.isArray(value) ? value.map(String) : []);
                for (const option of el.options) {
                    const next = selected.has(option.value);
                    if (option.selected !== next)
                        option.selected = next;
                }
            }
            else if (isCheckbox) {
                if (el.checked !== !!value)
                    el.checked = !!value;
            }
            else if (isRadio) {
                const checked = value != null && String(value) === el.value;
                if (el.checked !== checked)
                    el.checked = checked;
            }
            else {
                const next = value == null ? '' : String(value);
                if (el.value !== next)
                    el.value = next; // preserve caret on no-op patches
            }
        };
        const initial = manager.getStateByKey(stateKey);
        // Adopt user edits made while SSR HTML was visible before JS arrived.
        const editedSSR = !this.bindingInitialized && this.adoptedSSR && (isSelect
            ? Array.from(el.options).some(option => option.selected !== option.defaultSelected)
            : isCheckbox || isRadio ? el.checked !== el.defaultChecked
                : el.value !== el.defaultValue);
        this.bindingInitialized = true;
        if (editedSSR)
            commitInput();
        else if (initial != null) {
            if (isSelect)
                queueMicrotask(() => applyState(manager.getStateByKey(stateKey)));
            else
                applyState(initial);
        }
        const signal = (this.abortController ?? (this.abortController = new AbortController())).signal;
        const inputHandler = (event) => {
            if (this.composing || event.isComposing)
                return;
            commitInput();
        };
        const eventType = isCheckbox || isRadio || isSelect ? 'change' : 'input';
        this.element.addEventListener(eventType, inputHandler, { signal });
        if (!isSelect && !isCheckbox && !isRadio) {
            this.element.addEventListener('compositionstart', () => { this.composing = true; }, { signal });
            this.element.addEventListener('compositionend', () => {
                this.composing = false;
                commitInput();
            }, { signal });
        }
        (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(manager.subscribe([stateKey], () => applyState(manager.getStateByKey(stateKey))));
    }
    initializeAttributes() {
        const attrs = this.config.attrs;
        if (attrs) {
            for (const attrName in attrs)
                this._applyAttr(attrName, attrs[attrName]);
        }
        // @bind/@val — own top-level config bucket (sibling of attrs/props/events,
        // same shape/spirit as events — see ElementInterface.ts). Applied AFTER
        // attrs: setupTwoWayBinding needs el.type ('checkbox', 'radio', 'number'...)
        // already in place.
        if (this.config.bind?.key) {
            this.setupTwoWayBinding(this.config.bind.key);
        }
        // props độc lập với attrs/bind — element chỉ có props vẫn phải chạy
        if (this.config.props) {
            for (const [propName, propConfig] of Object.entries(this.config.props)) {
                if (propConfig.type === 'static' || propConfig.type === 'value') {
                    if (this.element[propName] !== propConfig.value)
                        this.element[propName] = propConfig.value;
                }
                else if (propConfig.type === 'binding') {
                    const generation = this.bindingGeneration;
                    const value = propConfig.factory ? propConfig.factory() : '';
                    if (value !== undefined && value !== null && value !== false) {
                        if (this.element[propName] !== value)
                            this.element[propName] = value;
                    }
                    else {
                        this.element[propName] = false;
                        delete this.element[propName];
                    }
                    // Reactive binding for properties
                    if (propConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(propConfig.stateKeys, () => {
                            if (!this.isBindingCurrent(generation))
                                return;
                            const newValue = propConfig.factory ? propConfig.factory() : '';
                            if (newValue !== undefined && newValue !== null && newValue !== false) {
                                if (this.element[propName] !== newValue)
                                    this.element[propName] = newValue;
                            }
                            else {
                                this.element[propName] = false;
                                delete this.element[propName];
                            }
                        });
                        (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
                    }
                }
            }
        }
    }
    /**
     * Apply một attr vào element, bao gồm:
     *   - Chuẩn hóa tên (camelCase → kebab-case cho data-* / aria-*)
     *   - Xử lý reactive binding
     */
    _applyAttr(attrName, attrConfig) {
        // FIX(Phase4): chuẩn hóa tên — dataCount → data-count
        const normalizedName = this.normalizeAttrName(attrName);
        // FIX(baseline#1): contract chuẩn là 'static' (compiler emit); 'value' giữ làm legacy alias
        if (attrConfig.type === 'static' || attrConfig.type === 'value') {
            if (this.skipStatic)
                return;
            if (attrConfig.value !== undefined && attrConfig.value !== null && attrConfig.value !== false) {
                if (this.element.getAttribute(normalizedName) !== String(attrConfig.value))
                    this.element.setAttribute(normalizedName, String(attrConfig.value));
            }
            else {
                this.element.removeAttribute(normalizedName);
            }
        }
        else if (attrConfig.type === 'binding') {
            const generation = this.bindingGeneration;
            const applyValue = () => {
                const newValue = attrConfig.factory ? attrConfig.factory() : '';
                if (newValue !== undefined && newValue !== null && newValue !== false) {
                    if (this.element.getAttribute(normalizedName) !== String(newValue))
                        this.element.setAttribute(normalizedName, String(newValue));
                }
                else {
                    this.element.removeAttribute(normalizedName);
                }
            };
            applyValue();
            if (attrConfig.stateKeys?.length) {
                const unsubscribe = this.ctx.states.__.subscribe(attrConfig.stateKeys, () => { if (this.isBindingCurrent(generation))
                    applyValue(); });
                (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
            }
            // `@yield(name, ...)` — no static stateKeys (the section it resolves to is
            // only known at runtime); subscribe to SectionManager by name instead, fires
            // both when a different section becomes active and when its value changes.
            if (attrConfig.yieldName) {
                const unsubscribe = SectionManager.subscribe(attrConfig.yieldName, () => { if (this.isBindingCurrent(generation))
                    applyValue(); });
                (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
            }
        }
    }
    /** Ghi một lần class hydrate (nếu bật) + mọi class tĩnh của element vừa tạo. */
    writePendingClass() {
        let value = this.pendingClass;
        this.pendingClass = null;
        const list = this.config.classes;
        if (Array.isArray(list)) {
            for (const item of list)
                if (item && item.type === 'static' && item.value)
                    value = value ? value + ' ' + item.value : item.value;
        }
        // `class` có thể đã được ghi qua attrs — khi đó nối thêm, không đè.
        // Bản sao của khuôn mang class hydrate của dòng làm khuôn → ghi đè hẳn.
        if (value) {
            if (!this.fromClone && this.element.hasAttribute('class'))
                this.addClass(value);
            else
                this.element.setAttribute('class', value);
        }
    }
    initializeClasses(written = false) {
        if (this.pendingClass !== null) {
            this.writePendingClass();
            written = true;
        }
        if (!this.config.classes)
            return;
        // New simplified format: classes: [{ type, value, factory?, stateKeys? }]
        if (Array.isArray(this.config.classes)) {
            for (const classConfig of this.config.classes) {
                if (!classConfig)
                    continue;
                // `class="language-{{ lang }}"` — factory trả về TÊN class chứ không
                // phải boolean, nên không có `value` tĩnh để bật/tắt. Phải nhớ lại tên
                // đã gắn để gỡ đúng chúng khi state đổi ('language-php' → 'language-js');
                // tên còn lại trên element có thể do nơi khác quản lý.
                if (classConfig.type === 'dynamic') {
                    const generation = this.bindingGeneration;
                    let applied = [];
                    const applyDynamic = () => {
                        const next = String(classConfig.factory ? classConfig.factory() : '')
                            .split(/\s+/).filter(Boolean);
                        for (const prev of applied) {
                            if (next.indexOf(prev) === -1) {
                                this.removeClass(prev);
                                this.dynamicClassNames?.delete(prev);
                            }
                        }
                        for (const name of next) {
                            this.addClass(name);
                            (this.dynamicClassNames ?? (this.dynamicClassNames = new Set())).add(name);
                        }
                        applied = next;
                    };
                    applyDynamic();
                    if (classConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(classConfig.stateKeys, () => { if (this.isBindingCurrent(generation))
                            applyDynamic(); });
                        (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
                    }
                    continue;
                }
                if (!classConfig.value)
                    continue;
                const className = classConfig.value;
                if (classConfig.type === 'static') {
                    // Vừa ghi cùng class hydrate ở trên → DOM đã có.
                    if (!written && !this.skipStatic)
                        this.addClass(className);
                    continue;
                }
                if (classConfig.type === 'binding') {
                    const generation = this.bindingGeneration;
                    const initialValue = classConfig.factory ? classConfig.factory() : false;
                    this.toggleClass(className, !!initialValue);
                    if (classConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(classConfig.stateKeys, () => {
                            if (!this.isBindingCurrent(generation))
                                return;
                            const newValue = classConfig.factory ? classConfig.factory() : false;
                            this.toggleClass(className, !!newValue);
                        });
                        (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
                    }
                }
            }
            return;
        }
        for (const [className, classConfig] of Object.entries(this.config.classes)) {
            if (classConfig.type === 'static') {
                if (classConfig.value) {
                    this.addClass(className);
                }
            }
            else if (classConfig.type === 'binding') {
                const generation = this.bindingGeneration;
                // Initial value
                const initialValue = classConfig.factory ? classConfig.factory() : !!classConfig.value;
                this.toggleClass(className, !!initialValue);
                // Subscribe for reactive updates
                if (classConfig.stateKeys?.length) {
                    const unsubscribe = this.ctx.states.__.subscribe(classConfig.stateKeys, () => {
                        if (!this.isBindingCurrent(generation))
                            return;
                        const newValue = classConfig.factory ? classConfig.factory() : false;
                        this.toggleClass(className, !!newValue);
                    });
                    (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
                }
            }
        }
    }
    addClass(className) {
        if (!className)
            return;
        if (className.includes(' ')) {
            const tokens = className.trim().split(/\s+/);
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i])
                    this.element.classList.add(tokens[i]);
            }
            return;
        }
        this.element.classList.add(className);
    }
    removeClass(className) {
        if (!className)
            return;
        if (className.includes(' ')) {
            const tokens = className.trim().split(/\s+/);
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i])
                    this.element.classList.remove(tokens[i]);
            }
            return;
        }
        this.element.classList.remove(className);
    }
    toggleClass(className, force) {
        if (!className)
            return;
        if (className.includes(' ')) {
            const tokens = className.trim().split(/\s+/);
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i])
                    if (this.element.classList.contains(tokens[i]) !== force)
                        this.element.classList.toggle(tokens[i], force);
            }
            return;
        }
        if (this.element.classList.contains(className) !== force)
            this.element.classList.toggle(className, force);
    }
    applyStyle(prop, value) {
        const text = String(value ?? '');
        if (this.element.style.getPropertyValue(prop) !== text)
            this.element.style.setProperty(prop, text);
    }
    initializeStyles() {
        if (!this.config.styles)
            return;
        for (const [prop, styleConfig] of Object.entries(this.config.styles)) {
            if (styleConfig.type === 'static' || styleConfig.type === 'value') {
                this.applyStyle(prop, styleConfig.value ?? '');
            }
            else if (styleConfig.type === 'binding') {
                const generation = this.bindingGeneration;
                // Initial value
                const initialValue = styleConfig.factory ? styleConfig.factory() : (styleConfig.value ?? '');
                this.applyStyle(prop, initialValue);
                // Subscribe for reactive updates
                if (styleConfig.stateKeys?.length) {
                    const unsubscribe = this.ctx.states.__.subscribe(styleConfig.stateKeys, () => {
                        if (!this.isBindingCurrent(generation))
                            return;
                        const newValue = styleConfig.factory ? styleConfig.factory() : '';
                        this.applyStyle(prop, newValue);
                    });
                    (this.bindingUnsubscribes ?? (this.bindingUnsubscribes = [])).push(unsubscribe);
                }
            }
        }
    }
    initializeEvents() {
        this.addEventListeners();
    }
    addEventListeners() {
        const events = this.config.events;
        if (!events)
            return;
        for (const eventName in events) {
            this.ctx.addEventListener(this.element, eventName, events[eventName], this.config.eventModifiers?.[eventName]);
            (this.registeredEventNames ?? (this.registeredEventNames = new Set())).add(eventName);
        }
    }
    /** Gỡ listener; truyền `keep` thì giữ lại các event còn trong config mới. */
    removeEventListeners(keep) {
        if (!this.registeredEventNames)
            return;
        for (const eventName of this.registeredEventNames) {
            if (keep && eventName in keep)
                continue;
            try {
                this.ctx.removeEventListener(this.element, eventName);
            }
            catch (error) {
                console.error(`[Html] Failed to remove "${eventName}" listener:`, error);
            }
            this.registeredEventNames.delete(eventName);
        }
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    setParent(parent) {
        this.parent = parent;
    }
    setChildrenFactory(factory) {
        this.childrenFactory = factory;
    }
    isSingleElement() {
        return this.isVoidTag;
    }
    getElement() {
        return this.element;
    }
    renderChildren() {
        let output;
        const scope = this.scope;
        if (!this.childrenFactory)
            output = [];
        else if (scope === null)
            output = this.childrenFactory(this);
        else {
            // Factory của element trong một dòng @foreach: chạy trong registry của dòng đó.
            const vc = this.ctx;
            const previous = vc.foreachRegistry, skip = vc._foreachSkipRegistry;
            vc.foreachRegistry = scope;
            vc._foreachSkipRegistry = false;
            try {
                output = this.childrenFactory(this);
            }
            finally {
                vc.foreachRegistry = previous;
                vc._foreachSkipRegistry = skip;
            }
        }
        const children = [];
        for (let i = 0; i < output.length; i++) {
            const child = output[i];
            if (child === null || child === undefined)
                continue;
            children.push(typeof child === 'string' || typeof child === 'number'
                ? this.primitiveText(child)
                : child);
        }
        this.children = children;
        return this.children;
    }
    /** Chuỗi/số trần trong danh sách con — dựng sau factory nên không theo được thứ tự nhận node của khuôn. */
    primitiveText(child) {
        this.ctx._adoptOk = false;
        this.ctx._structDirty = true;
        return new TextElement({ ctx: this.ctx, parent: this.parent, text: String(child) });
    }
    /** Dựng cây con NGAY, trước khi element được gắn vào trang (dòng nhân bản / dòng làm khuôn). */
    prerender() {
        const vc = this.ctx;
        this.render();
        if (!(vc._probing && vc._structDirty))
            this.prerendered = true;
    }
    /**
     * Cây con của element này có dùng làm khuôn nhân bản được không: chỉ Html,
     * chữ tĩnh và `{{ }}` — những thứ mà mọi phần động đều được ghi lại (có so
     * sánh) khi dựng trên bản sao. Loại: @bind và ô nhập (cloneNode chép cả
     * giá trị đang gõ), class tính lúc chạy, transition, vùng tự quản DOM.
     */
    cloneable() {
        const config = this.config;
        if (config.bind || config.transition || config.element)
            return false;
        const tag = this.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option')
            return false;
        if (this.element.hasAttribute('data-sao-preserve-children'))
            return false;
        if (Array.isArray(config.classes)) {
            for (const item of config.classes)
                if (item && item.type === 'dynamic')
                    return false;
        }
        for (const child of this.children) {
            if (child instanceof Html) {
                if (!child.cloneable())
                    return false;
            }
            else if (child instanceof TextElement) {
                if (!child.isStatic)
                    return false;
            }
            else if (child && child.saoType === 'Output') {
                if (!child.isEscapeHTML)
                    return false;
            }
            else
                return false;
        }
        return true;
    }
    render() {
        if (this.prerendered) {
            // Đã dựng trong __foreach; đây là lượt render của chính pass đó.
            this.prerendered = false;
            return this.element;
        }
        const previous = this.children;
        if (this.isSingleElement()) {
            return this.element;
        }
        // Editors own their inner DOM, selection and composition state. Reconcile the
        // host's attributes/events normally, but leave an explicitly declared island alone.
        if (this.element.hasAttribute('data-sao-preserve-children')) {
            this.initMode = InitModes.CREATE;
            this.maybeRunEnter();
            return this.element;
        }
        if (this.config.content) {
            this.renderTextContent();
            return this.element;
        }
        // Element nhân bản, lượt dựng đầu: con của nó nằm sẵn trong bản sao.
        // Mở "cửa sổ nhận node" quanh factory — Html/Output/chữ tĩnh tạo ra
        // trong đó lấy node theo thứ tự thay vì tạo mới.
        const vc = this.ctx;
        const adopting = this.fromClone && previous.length === 0 && !this.cloneBuilt;
        let adopted = false;
        let children = [];
        if (adopting) {
            this.cloneBuilt = true;
            const wasActive = vc._adoptActive, cursor = vc._adoptCursor, ok = vc._adoptOk;
            vc._adoptActive = true;
            vc._adoptCursor = this.element.firstChild;
            vc._adoptOk = true;
            try {
                if (this.childrenFactory)
                    children = this.renderChildren();
                adopted = vc._adoptOk && vc._adoptCursor === null;
            }
            finally {
                vc._adoptActive = wasActive;
                vc._adoptCursor = cursor;
                vc._adoptOk = ok;
            }
        }
        else if (this.childrenFactory) {
            children = this.renderChildren();
        }
        children = this.children = reuseStaticText(previous, children);
        if (vc._probing) {
            // Dựng thử dòng làm khuôn: gặp con không nhân bản được (component,
            // khối reactive, vòng lặp…) thì dừng TRƯỚC khi dựng nó — nó sẽ được
            // dựng ở lượt render thường, sau khi dòng đã nằm trong trang.
            let plain = !vc._structDirty;
            for (let i = 0; plain && i < children.length; i++) {
                const child = children[i];
                plain = child instanceof Html || child instanceof TextElement || child.saoType === 'Output';
            }
            if (!plain) {
                vc._structDirty = true;
                this.children = NO_CHILDREN;
                return this.element;
            }
        }
        if (adopting) {
            if (adopted) {
                for (let i = 0; i < children.length; i++)
                    children[i].render?.();
            }
            else {
                // Cây con không khớp khuôn (hiếm): đường tổng quát tự xếp lại và dọn node thừa.
                reconcileChildren(this.element, [], children);
                removeUnmanagedNodes(this.element, this.element.firstChild, null, children);
            }
            this.applyOptionSelection();
            if (this.isStarted)
                for (const child of children)
                    child.start?.();
            this.maybeRunEnter();
            return this.element;
        }
        if (this.initMode === InitModes.HYDRATE) {
            // ── Hydrate mode: DOM đã có từ server ────────────────────────
            // renderChildren() đã tạo JS objects (Html claim DOM, Output claim markers).
            // hydrateElementList gọi render() đệ quy để children cũng claim DOM,
            // nhưng KHÔNG appendChild — giữ nguyên server-rendered DOM.
            if (children && children.length > 0) {
                hydrateElementList(this, children);
            }
            this.applyOptionSelection();
            this.initMode = InitModes.CREATE;
            return this.element;
        }
        if (previous.length === 0 && this.element.firstChild === null) {
            // ── Lần dựng đầu của element vừa tạo: không có gì để đối chiếu ──
            // Nối thẳng theo thứ tự; bỏ qua toàn bộ phần diff, lưu/khôi phục
            // focus và dọn node lạ của reconcileChildren.
            const host = this.element;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const single = child.element;
                if (single)
                    host.appendChild(single);
                else if (child.openTag && child.closeTag) {
                    host.appendChild(child.openTag);
                    host.appendChild(child.closeTag);
                }
            }
            for (let i = 0; i < children.length; i++) {
                children[i].render?.();
                if (vc._probing && vc._structDirty)
                    return this.element; // phần còn lại: lượt render thường
            }
        }
        else {
            reconcileChildren(this.element, previous, children);
            removeUnmanagedNodes(this.element, this.element.firstChild, null, children);
        }
        this.applyOptionSelection();
        if (this.isStarted)
            for (const child of children)
                child.start?.();
        this.maybeRunEnter();
        return this.element;
    }
    applyOptionSelection() {
        if (!this.isOptionTag)
            return;
        const selected = this.config.props?.selected;
        if (!selected)
            return;
        // Insertion into a select may choose an option automatically. Apply the
        // declared selection again after its DOM and text children are mounted.
        this.element.selected = Boolean(selected.type === 'binding'
            ? selected.factory?.() : selected.value);
    }
    renderTextContent() {
        this.contentUnsubscribe?.();
        this.contentUnsubscribe = null;
        const content = this.config.content;
        const isTextarea = this.isTextareaTag;
        const generation = this.bindingGeneration;
        const apply = () => {
            if (!this.isBindingCurrent(generation))
                return;
            const value = String(content.factory() ?? '');
            if (isTextarea) {
                const textarea = this.element;
                // @bind owns the live value when both forms are declared.
                if (!this.config.bind && textarea.value !== value)
                    textarea.value = value;
            }
            else if (this.element.textContent !== value) {
                this.element.textContent = value;
            }
        };
        if (this.contentRendered)
            apply();
        else if (!this.adoptedSSR) {
            const value = String(content.factory() ?? '');
            if (isTextarea) {
                const textarea = this.element;
                // Match HTML parsing: one initial LF after <textarea> is ignored.
                textarea.defaultValue = value.replace(/^\n/, '');
                if (!this.config.bind)
                    textarea.value = textarea.defaultValue;
            }
            else {
                this.element.textContent = value;
            }
        }
        this.contentRendered = true;
        // Hydration adopts SSR content, including input typed before JS loaded.
        // Future state changes patch the property, preserving the node itself.
        if (content.stateKeys?.length && !(isTextarea && this.config.bind)) {
            this.contentUnsubscribe = this.ctx.states.__.subscribe(content.stateKeys, apply);
        }
    }
    /**
     * Enter chạy MỘT lần, khi element vừa được tạo và đã nằm trong DOM.
     * Bỏ qua ở HYDRATE: DOM đó do server render, animate lại là nháy vô cớ
     * (tương đương `appear = false` mặc định của Vue).
     */
    maybeRunEnter() {
        if (this._entered)
            return;
        const name = this.config.transition?.name;
        if (!name)
            return;
        if (this.initMode === InitModes.HYDRATE) {
            this._entered = true;
            return;
        }
        if (!this.element.isConnected)
            return; // caller chưa chèn — thử lại lần render sau
        this._entered = true;
        void runEnter(this.element, name);
    }
    appendElement(element) {
        this.element.appendChild(element);
    }
    /** Start reactive bindings + children (Phase 2 lifecycle) */
    start() {
        // Đã chạy thì mọi child hiện có cũng đã chạy: child sinh sau do chính
        // lượt render tạo ra nó start (xem cuối render()). Thiếu chốt này mỗi
        // lượt render lại duyệt start() xuống TOÀN BỘ cây con.
        if (this.isStarted)
            return;
        this.isStarted = true;
        for (const child of this.children) {
            if ('start' in child && typeof child.start === 'function') {
                child.start();
            }
        }
    }
    /** Stop reactive bindings + children */
    stop() {
        this.isStarted = false;
        for (const child of this.children) {
            if ('stop' in child && typeof child.stop === 'function') {
                child.stop();
            }
        }
    }
    clearHTML() {
        this.element.innerHTML = '';
    }
    remove() {
        this.element.remove();
    }
    destroy() {
        if (this.__destroyed__)
            return;
        this.__destroyed__ = true;
        this.ctx.releaseElement?.(this);
        this.removeEventListeners();
        // Abort @bind listeners and unsubscribe every reactive attr/prop/class/style.
        this.cleanupBindingResources();
        const transitionName = this.config.transition?.name;
        if (transitionName && this.element.isConnected) {
            // HOÃN teardown cây con: destroy() của child Html gỡ luôn DOM của nó,
            // nên dọn ngay sẽ làm element bay ra trong trạng thái RỖNG. Element
            // đã inert (listener gỡ, binding huỷ) nên giữ lại chỉ là phần nhìn.
            // runLeave() tự gỡ node khi xong — không remove() ở đây.
            //
            // NHƯNG phải nhả id của CẢ CÂY CON khỏi registry NGAY. Một element
            // đang leave là element đã chết về mặt logic; nếu id của nó còn
            // trong `ctx.elements` thì pass render kế tiếp sẽ `aliveFromRegistry`
            // trúng nó (chưa `__destroyed__` vì teardown bị hoãn) và tái dùng —
            // Component thì `_childMounted` vẫn true nên `mountChild()` return
            // ngay ⇒ vùng @include/@if của hàng mới RỖNG. Đây đúng là lớp lỗi
            // §2.10, quay lại qua đường transition.
            this.releaseSubtreeFromRegistry();
            void runLeave(this.element, transitionName).then(() => this.teardownSubtree());
            return;
        }
        // Gỡ element khỏi DOM TRƯỚC — destroy là vĩnh viễn. Cây con sau đó tự
        // dọn trên một nhánh đã rời tài liệu, thay vì mỗi node con gây một lượt
        // vô hiệu hoá style/layout trên cây đang sống.
        if (isDiscarded(this.element)) {
            this.teardownSubtree();
            return;
        }
        this.element.remove();
        discarding(this.element, () => this.teardownSubtree());
    }
    /**
     * Nhả id của element này và toàn bộ cây con khỏi `ctx.elements`, KHÔNG
     * destroy. Dùng khi leave transition giữ DOM lại: registry phải sạch ngay
     * để pass sau tạo element mới thay vì tái dùng xác sắp chết.
     */
    releaseSubtreeFromRegistry() {
        const release = (node) => {
            if (!node || typeof node !== 'object')
                return;
            this.ctx.releaseElement?.(node);
            const kids = node.children;
            if (Array.isArray(kids))
                for (const k of kids)
                    release(k);
        };
        for (const child of this.children)
            release(child);
    }
    /** Destroy children + dọn nội dung. Tách riêng để leave hoãn được. */
    teardownSubtree() {
        const children = this.children;
        this.children = NO_CHILDREN;
        for (let i = 0; i < children.length; i++)
            children[i].destroy?.();
        if (this.element.firstElementChild && !isDiscarded(this.element)) {
            this.element.innerHTML = '';
        }
    }
    get isSaoElement() {
        return true;
    }
    set isSaoElement(value) {
        // No-op setter to satisfy the Interface; this property is always true for Html elements
    }
    get isOneHtml() {
        return true;
    }
    set isOneHtml(value) {
        // No-op setter to satisfy the Interface; this property is always true for Html elements
    }
}
/**
 * CHỈ cho kiểm thử: bật thì element tạo ở client cũng mang class hydrate
 * `{viewId}-{id}` như DOM của server. Cổng parity SSR↔CSR dựa vào class
 * đó để biết element nào do compiler sinh; production để tắt (mỗi element
 * một tên class duy nhất là ~1/3 thời gian tạo một danh sách dài).
 * Bật trước khi app khởi động: `window.__SAOLA_CSR_HYDRATE_CLASS__ = true`.
 */
Html.csrHydrateClass = !!globalThis.__SAOLA_CSR_HYDRATE_CLASS__;
//# sourceMappingURL=Html.js.map