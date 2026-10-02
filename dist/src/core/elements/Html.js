import { reconcileChildren, reuseStaticText } from './reconcileChildren.js';
import { InitModes } from "../contracts/common.js";
import { hydrateElementList } from "../helpers/view.js";
import { TextElement } from "./TextElement.js";
import SectionManager from "../services/SectionManager.js";
import { runEnter, runLeave } from "../helpers/transition.js";
/**
 * Escape một chuỗi để dùng làm CSS class/id selector. Class hydrate dạng
 * "{viewId}-{id}" có viewId là hex (uniqid) CÓ THỂ bắt đầu bằng chữ số, làm
 * ".6a3a..." trở thành selector không hợp lệ → querySelector ném SyntaxError.
 * Dùng CSS.escape khi có; fallback escape thủ công ký tự đầu là số + ký tự đặc biệt.
 */
function cssEscape(value) {
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
function createDomElement(tagName, parentElement) {
    const parent = parentElement?.element;
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
export class Html {
    constructor({ ctx, id = null, parentElement = null, tagName = 'div', element = null, config = {}, childrenFactory = null, initMode = InitModes.CREATE, }) {
        this.saoType = 'Html';
        this.children = [];
        this.domChildren = []; // For compatibility with HtmlInterface; Html itself doesn't have a single root element
        this.childrenFactory = null;
        this.abortController = new AbortController();
        /** All state subscriptions for reactive bindings — cleanup on destroy */
        this.bindingUnsubscribes = [];
        /** Invalidates deferred/stale binding callbacks after a config reconciliation. */
        this.bindingGeneration = 0;
        this.contentUnsubscribe = null;
        /** DOM state owned by this Html config, used for exact cleanup before reuse. */
        this.managedAttributeNames = new Set();
        this.managedClassNames = new Set();
        this.managedStyleNames = new Set();
        this.managedPropertyNames = new Set();
        /** Events actually registered through ViewController, independent of current config. */
        this.registeredEventNames = new Set();
        this.initMode = InitModes.CREATE;
        this.adoptedSSR = false;
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
                this.element = createDomElement(tagName, parentElement);
                if (hydrateClass)
                    this.element.classList.add(hydrateClass);
            }
        }
        else {
            // ── CSR (create mode): tạo element mới ───────────────────────────────
            this.element = createDomElement(this.tagName, parentElement);
            if (hydrateClass)
                this.element.classList.add(hydrateClass);
        }
        this.childrenFactory = childrenFactory;
        this.initialize();
    }
    updateConfig(newConfig) {
        if (this.__destroyed__)
            return;
        // Reuse must behave like a fresh initialization without replacing the DOM
        // node: remove every resource owned by the previous config first, then make
        // the new managed sections authoritative. This prevents stale attrs,
        // duplicate events, and state subscriptions retaining old closures.
        this.removeEventListeners();
        this.cleanupBindingResources();
        this.clearManagedDomState(newConfig);
        this.config = {
            ...this.config,
            ...newConfig,
            attrs: newConfig.attrs,
            props: newConfig.props,
            events: newConfig.events,
            classes: newConfig.classes,
            styles: newConfig.styles,
            bind: newConfig.bind,
            content: newConfig.content,
        };
        this.initialize();
    }
    initialize() {
        this.initializeAttributes();
        this.initializeClasses();
        this.initializeStyles();
        this.initializeEvents();
    }
    isBindingCurrent(generation) {
        return !this.__destroyed__ && generation === this.bindingGeneration;
    }
    cleanupBindingResources(renewAbortController = true) {
        this.bindingGeneration++;
        this.contentUnsubscribe?.();
        this.contentUnsubscribe = null;
        this.abortController.abort();
        if (renewAbortController) {
            this.abortController = new AbortController();
        }
        for (const unsubscribe of this.bindingUnsubscribes) {
            try {
                unsubscribe();
            }
            catch (error) {
                console.error('[Html] Failed to unsubscribe a reactive binding:', error);
            }
        }
        this.bindingUnsubscribes = [];
    }
    clearManagedDomState(next = {}) {
        const attrs = new Set(Object.keys(next.attrs ?? {}).map(name => this.normalizeAttrName(name)));
        const classes = new Set();
        if (Array.isArray(next.classes)) {
            for (const item of next.classes)
                if (item && item.type !== 'dynamic' && item.value)
                    classes.add(String(item.value));
        }
        else {
            for (const [name, item] of Object.entries(next.classes ?? {})) {
                if (item.type === 'binding' || item.value)
                    classes.add(name);
            }
        }
        for (const attrName of this.managedAttributeNames) {
            if (!attrs.has(attrName))
                this.element.removeAttribute(attrName);
        }
        this.managedAttributeNames.clear();
        for (const className of this.managedClassNames) {
            if (!classes.has(className))
                this.removeClass(className);
        }
        this.managedClassNames.clear();
        for (const prop of this.managedStyleNames) {
            if (!(prop in (next.styles ?? {})))
                this.element.style.removeProperty(prop);
        }
        this.managedStyleNames.clear();
        const removedProps = [...this.managedPropertyNames].filter(name => !(name in (next.props ?? {})));
        const defaults = removedProps.length ? createDomElement(this.tagName, this.parent) : {};
        const target = this.element;
        for (const propName of removedProps) {
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
        this.managedPropertyNames.clear();
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
        if (/^data[A-Z]/.test(name)) {
            return 'data-' + name[4].toLowerCase() + name.slice(5).replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        }
        if (/^aria[A-Z]/.test(name)) {
            return 'aria-' + name[4].toLowerCase() + name.slice(5).replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        }
        return name;
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
        const signal = this.abortController.signal;
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
        this.bindingUnsubscribes.push(manager.subscribe([stateKey], () => applyState(manager.getStateByKey(stateKey))));
    }
    initializeAttributes() {
        const attrs = this.config.attrs;
        if (attrs) {
            for (const [attrName, attrConfig] of Object.entries(attrs)) {
                this._applyAttr(attrName, attrConfig);
            }
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
                this.managedPropertyNames.add(propName);
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
                        this.bindingUnsubscribes.push(unsubscribe);
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
        this.managedAttributeNames.add(normalizedName);
        // FIX(baseline#1): contract chuẩn là 'static' (compiler emit); 'value' giữ làm legacy alias
        if (attrConfig.type === 'static' || attrConfig.type === 'value') {
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
                this.bindingUnsubscribes.push(unsubscribe);
            }
            // `@yield(name, ...)` — no static stateKeys (the section it resolves to is
            // only known at runtime); subscribe to SectionManager by name instead, fires
            // both when a different section becomes active and when its value changes.
            if (attrConfig.yieldName) {
                const unsubscribe = SectionManager.subscribe(attrConfig.yieldName, () => { if (this.isBindingCurrent(generation))
                    applyValue(); });
                this.bindingUnsubscribes.push(unsubscribe);
            }
        }
    }
    initializeClasses() {
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
                                this.managedClassNames.delete(prev);
                            }
                        }
                        for (const name of next) {
                            this.addClass(name);
                            this.managedClassNames.add(name);
                        }
                        applied = next;
                    };
                    applyDynamic();
                    if (classConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(classConfig.stateKeys, () => { if (this.isBindingCurrent(generation))
                            applyDynamic(); });
                        this.bindingUnsubscribes.push(unsubscribe);
                    }
                    continue;
                }
                if (!classConfig.value)
                    continue;
                const className = classConfig.value;
                this.managedClassNames.add(className);
                if (classConfig.type === 'static') {
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
                        this.bindingUnsubscribes.push(unsubscribe);
                    }
                }
            }
            return;
        }
        for (const [className, classConfig] of Object.entries(this.config.classes)) {
            this.managedClassNames.add(className);
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
                    this.bindingUnsubscribes.push(unsubscribe);
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
                    if (!this.element.classList.contains(tokens[i]))
                        this.element.classList.add(tokens[i]);
            }
            return;
        }
        if (!this.element.classList.contains(className))
            this.element.classList.add(className);
    }
    removeClass(className) {
        if (!className)
            return;
        if (className.includes(' ')) {
            const tokens = className.trim().split(/\s+/);
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i])
                    if (this.element.classList.contains(tokens[i]))
                        this.element.classList.remove(tokens[i]);
            }
            return;
        }
        if (this.element.classList.contains(className))
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
            this.managedStyleNames.add(prop);
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
                    this.bindingUnsubscribes.push(unsubscribe);
                }
            }
        }
    }
    initializeEvents() {
        this.addEventListeners();
    }
    addEventListeners() {
        if (this.config.events) {
            for (const [eventName, handlers] of Object.entries(this.config.events)) {
                this.ctx.addEventListener(this.element, eventName, handlers, this.config.eventModifiers?.[eventName]);
                this.registeredEventNames.add(eventName);
            }
        }
    }
    removeEventListeners() {
        for (const eventName of this.registeredEventNames) {
            try {
                this.ctx.removeEventListener(this.element, eventName);
            }
            catch (error) {
                console.error(`[Html] Failed to remove "${eventName}" listener:`, error);
            }
        }
        this.registeredEventNames.clear();
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
        return ['input', 'img', 'br', 'hr', 'meta', 'link'].includes(this.tagName.toLowerCase());
    }
    getElement() {
        return this.element;
    }
    renderChildren() {
        const children = this.childrenFactory ? this.childrenFactory(this) : [];
        this.children = [];
        this.children = children
            .filter((child) => child !== null && child !== undefined)
            .map((child) => {
            if (typeof child === 'string' || typeof child === 'number') {
                return new TextElement({ ctx: this.ctx, parent: this.parent, stateKeys: [], generateText: () => String(child) });
            }
            return child;
        });
        return this.children;
    }
    render() {
        const previous = this.children;
        if (this.isSingleElement()) {
            return this.element;
        }
        if (this.config.content) {
            this.renderTextContent();
            return this.element;
        }
        let children = [];
        if (this.childrenFactory) {
            children = this.renderChildren();
        }
        children = this.children = reuseStaticText(previous, children);
        if (this.initMode === InitModes.HYDRATE) {
            // ── Hydrate mode: DOM đã có từ server ────────────────────────
            // renderChildren() đã tạo JS objects (Html claim DOM, Output claim markers).
            // hydrateElementList gọi render() đệ quy để children cũng claim DOM,
            // nhưng KHÔNG appendChild — giữ nguyên server-rendered DOM.
            if (children && children.length > 0) {
                hydrateElementList(this, children);
            }
            this.initMode = InitModes.CREATE;
            return this.element;
        }
        reconcileChildren(this.element, previous, children);
        // Drop unmanaged nodes left by previous renders, retaining marker ranges.
        const keep = new Set();
        for (const child of children) {
            const first = child.element ?? child.openTag;
            const last = child.element ?? child.closeTag;
            let current = first;
            while (current) {
                keep.add(current);
                if (current === last)
                    break;
                current = current.nextSibling ?? undefined;
            }
        }
        for (const node of Array.from(this.element.childNodes))
            if (!keep.has(node))
                node.remove();
        if (this.isStarted)
            for (const child of children)
                child.start?.();
        this.maybeRunEnter();
        return this.element;
    }
    renderTextContent() {
        this.contentUnsubscribe?.();
        this.contentUnsubscribe = null;
        const content = this.config.content;
        const isTextarea = this.tagName.toLowerCase() === 'textarea';
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
        this.cleanupBindingResources(false);
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
        this.teardownSubtree();
        // Gỡ element khỏi DOM — destroy là vĩnh viễn
        this.element.remove();
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
        this.children.forEach(child => {
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy();
            }
        });
        this.children = [];
        if (this.element.children.length > 0) {
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
//# sourceMappingURL=Html.js.map