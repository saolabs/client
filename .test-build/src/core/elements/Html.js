"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Html = void 0;
const common_1 = require("../contracts/common");
const utils_1 = require("../helpers/utils");
const view_1 = require("../helpers/view");
const TextElement_1 = require("./TextElement");
class Html {
    constructor({ ctx, id = null, parentElement = null, tagName = 'div', element = null, config = {}, childrenFactory = null, initMode = common_1.InitModes.CREATE, }) {
        this.saoType = 'Html';
        this.children = [];
        this.domChildren = []; // For compatibility with HtmlInterface; Html itself doesn't have a single root element
        this.childrenFactory = null;
        this.abortController = new AbortController();
        /** All state subscriptions for reactive bindings — cleanup on destroy */
        this.bindingUnsubscribes = [];
        this.initMode = common_1.InitModes.CREATE;
        /** Registry guard — element đã destroy không được reuse (xem RUNTIME_CONTRACT.md §2) */
        this.__destroyed__ = false;
        this.ctx = ctx;
        this.parent = parentElement;
        this.config = config;
        this.tagName = tagName;
        this.initMode = initMode;
        const shouldHydrate = config.hydrate && initMode === common_1.InitModes.HYDRATE;
        const onlySync = (initMode === common_1.InitModes.HYDRATE && config.element instanceof HTMLElement) || element instanceof HTMLElement;
        if (onlySync) {
            this.element = element || config.element;
            this.tagName = this.element.tagName.toLowerCase();
        }
        else if (shouldHydrate && config.selector) {
            const found = document.querySelector(`${tagName}.${id}`);
            if (found instanceof HTMLElement) {
                this.element = found;
                this.tagName = found.tagName.toLowerCase();
            }
            else {
                this.element = document.createElement(tagName);
                if (id)
                    this.element.classList.add(id); // classList.add('') throws SyntaxError
                console.warn(`[Html] Selector "${config.selector}" not found, created new <${tagName}>.`);
            }
        }
        else {
            this.element = document.createElement(this.tagName);
            if (id)
                this.element.classList.add(id);
            if (shouldHydrate) {
                console.warn(`[Html] No selector for hydration, created new <${tagName}>.`);
            }
        }
        this.childrenFactory = childrenFactory;
        this.initialize();
    }
    updateConfig(newConfig) {
        if ((0, utils_1.hasData)(newConfig)) {
            this.config = { ...this.config, ...newConfig };
        }
    }
    initialize() {
        this.initializeAttributes();
        this.initializeClasses();
        this.initializeStyles();
        this.initializeEvents();
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
            return 'data-' + name.slice(4).replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        }
        if (/^aria[A-Z]/.test(name)) {
            return 'aria-' + name.slice(4).replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        }
        return name;
    }
    /**
     * Thiết lập two-way data binding (v-model-like) theo compiler pattern:
     *
     *   attrs: { "bind": { type: 'static', value: true }, "<stateKey>": { type: 'static', value: true } }
     *
     *   - "bind": true          → bật two-way binding
     *   - "<stateKey>": true    → tên state key cần bind (e.g. "newTodo")
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
        // 1. Khởi tạo value từ state (nếu state đã có)
        const initial = manager.getStateByKey(stateKey);
        if (initial !== null && initial !== undefined) {
            this.element.value = String(initial);
        }
        // 2. input/change event → update state
        const inputHandler = (e) => {
            const target = e.target;
            const setter = manager.setters[stateKey];
            if (typeof setter === 'function') {
                setter(target.type === 'checkbox' ? target.checked : target.value);
            }
            else {
                // Fallback: updateStateByKey trực tiếp
                manager.updateStateByKey(stateKey, target.type === 'checkbox' ? target.checked : target.value);
            }
        };
        const eventType = this.element.type === 'checkbox' ? 'change' : 'input';
        this.element.addEventListener(eventType, inputHandler, { signal: this.abortController.signal });
        // 3. state → element.value (reactive update)
        const unsubscribe = manager.subscribe([stateKey], () => {
            const newVal = manager.getStateByKey(stateKey);
            if (this.element.type === 'checkbox') {
                this.element.checked = !!newVal;
            }
            else {
                this.element.value = newVal !== null && newVal !== undefined
                    ? String(newVal) : '';
            }
        });
        this.bindingUnsubscribes.push(unsubscribe);
    }
    initializeAttributes() {
        const attrs = this.config.attrs;
        if (!attrs)
            return;
        // ─── Detect @bind directive (two-way binding) ─────────────
        // Pattern từ compiler: { "bind": {type:'static', value:true}, "<stateKey>": {type:'static', value:true} }
        // Tham chiếu: COMPILER_CONTRACT.md §5.
        const bindAttr = attrs['bind'];
        if (bindAttr?.type === 'static' && bindAttr?.value === true) {
            const stateKey = Object.keys(attrs).find(k => {
                if (k === 'bind')
                    return false;
                const v = attrs[k];
                // State key marker: { type: 'static', value: true }
                return v.type === 'static' && v.value === true;
            });
            if (stateKey) {
                this.setupTwoWayBinding(stateKey);
                // Sau khi xử lý bind, skip toàn bộ attr loop cho bind + stateKey attrs
                // để không set attribute "bind=true" hay "newTodo=true" trên DOM.
                for (const [attrName, attrConfig] of Object.entries(attrs)) {
                    if (attrName === 'bind' || (attrConfig.type === 'static' && attrConfig.value === true))
                        continue;
                    this._applyAttr(attrName, attrConfig);
                }
                return;
            }
        }
        // ─── Normal attrs ──────────────────────────────────────────
        for (const [attrName, attrConfig] of Object.entries(attrs)) {
            this._applyAttr(attrName, attrConfig);
        }
        if (this.config.props) {
            for (const [propName, propConfig] of Object.entries(this.config.props)) {
                if (propConfig.type === 'static' || propConfig.type === 'value') {
                    this.element[propName] = propConfig.value;
                }
                else if (propConfig.type === 'binding') {
                    const value = propConfig.factory ? propConfig.factory() : '';
                    if (value !== undefined && value !== null && value !== false) {
                        this.element[propName] = value;
                    }
                    else {
                        this.element[propName] = false;
                        delete this.element[propName];
                    }
                    // Reactive binding for properties
                    if (propConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(propConfig.stateKeys, () => {
                            const newValue = propConfig.factory ? propConfig.factory() : '';
                            if (newValue !== undefined && newValue !== null && newValue !== false) {
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
        // FIX(baseline#1): contract chuẩn là 'static' (compiler emit); 'value' giữ làm legacy alias
        if (attrConfig.type === 'static' || attrConfig.type === 'value') {
            if (attrConfig.value !== undefined && attrConfig.value !== null && attrConfig.value !== false) {
                this.element.setAttribute(normalizedName, String(attrConfig.value));
            }
        }
        else if (attrConfig.type === 'binding') {
            const value = attrConfig.factory ? attrConfig.factory() : '';
            if (value !== undefined && value !== null && value !== false) {
                this.element.setAttribute(normalizedName, String(value));
            }
            else {
                this.element.removeAttribute(normalizedName);
            }
            if (attrConfig.stateKeys?.length) {
                const unsubscribe = this.ctx.states.__.subscribe(attrConfig.stateKeys, () => {
                    const newValue = attrConfig.factory ? attrConfig.factory() : '';
                    if (newValue !== undefined && value !== null && newValue !== false) {
                        this.element.setAttribute(normalizedName, String(newValue));
                    }
                    else {
                        this.element.removeAttribute(normalizedName);
                    }
                });
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
                if (!classConfig || !classConfig.value)
                    continue;
                const className = classConfig.value;
                if (classConfig.type === 'static') {
                    this.element.classList.add(className);
                    continue;
                }
                if (classConfig.type === 'binding') {
                    const initialValue = classConfig.factory ? classConfig.factory() : false;
                    this.element.classList.toggle(className, !!initialValue);
                    if (classConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(classConfig.stateKeys, () => {
                            const newValue = classConfig.factory ? classConfig.factory() : false;
                            this.element.classList.toggle(className, !!newValue);
                        });
                        this.bindingUnsubscribes.push(unsubscribe);
                    }
                }
            }
            return;
        }
        for (const [className, classConfig] of Object.entries(this.config.classes)) {
            if (classConfig.type === 'static') {
                if (classConfig.value) {
                    this.element.classList.add(className);
                }
            }
            else if (classConfig.type === 'binding') {
                // Initial value
                const initialValue = classConfig.factory ? classConfig.factory() : !!classConfig.value;
                this.element.classList.toggle(className, !!initialValue);
                // Subscribe for reactive updates
                if (classConfig.stateKeys?.length) {
                    const unsubscribe = this.ctx.states.__.subscribe(classConfig.stateKeys, () => {
                        const newValue = classConfig.factory ? classConfig.factory() : false;
                        this.element.classList.toggle(className, !!newValue);
                    });
                    this.bindingUnsubscribes.push(unsubscribe);
                }
            }
        }
    }
    initializeStyles() {
        if (!this.config.styles)
            return;
        for (const [prop, styleConfig] of Object.entries(this.config.styles)) {
            if (styleConfig.type === 'static' || styleConfig.type === 'value') {
                this.element.style.setProperty(prop, styleConfig.value ?? '');
            }
            else if (styleConfig.type === 'binding') {
                // Initial value
                const initialValue = styleConfig.factory ? styleConfig.factory() : (styleConfig.value ?? '');
                this.element.style.setProperty(prop, initialValue);
                // Subscribe for reactive updates
                if (styleConfig.stateKeys?.length) {
                    const unsubscribe = this.ctx.states.__.subscribe(styleConfig.stateKeys, () => {
                        const newValue = styleConfig.factory ? styleConfig.factory() : '';
                        this.element.style.setProperty(prop, newValue);
                    });
                    this.bindingUnsubscribes.push(unsubscribe);
                }
            }
        }
    }
    initializeEvents() {
        if (this.config.events) {
            for (const [eventName, handlers] of Object.entries(this.config.events)) {
                this.ctx.addEventListener(this.element, eventName, handlers);
            }
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
                return new TextElement_1.TextElement({ ctx: this.ctx, parent: this.parent, stateKeys: [], generateText: () => String(child) });
            }
            return child;
        });
        return this.children;
    }
    render() {
        if (this.isSingleElement()) {
            return this.element;
        }
        let children = [];
        if (this.childrenFactory) {
            // Compiled output uses (parentElement) => [...] — pass `this` as parentElement
            children = this.renderChildren();
        }
        // CLEAR EXISTING CONTENT BEFORE RENDERING NEW CHILDREN
        this.element.innerHTML = ''; // Clear existing content before rendering children
        if (children && children.length > 0) {
            (0, view_1.mountElementList)(this, children);
        }
        return this.element;
    }
    appendElement(element) {
        this.element.appendChild(element);
    }
    /** Start reactive bindings + children (Phase 2 lifecycle) */
    start() {
        for (const child of this.children) {
            if ('start' in child && typeof child.start === 'function') {
                child.start();
            }
        }
    }
    /** Stop reactive bindings + children */
    stop() {
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
        this.__destroyed__ = true;
        // Abort all registered event listeners
        this.abortController.abort();
        this.abortController = new AbortController();
        // Cleanup reactive binding subscriptions
        for (const unsub of this.bindingUnsubscribes) {
            unsub();
        }
        this.bindingUnsubscribes = [];
        // Destroy children recursively
        this.children.forEach(child => {
            if ('destroy' in child && typeof child.destroy === 'function') {
                child.destroy();
            }
        });
        this.children = [];
        if (this.element.children.length > 0) {
            this.element.innerHTML = '';
        }
        // Gỡ element khỏi DOM — destroy là vĩnh viễn
        this.element.remove();
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
exports.Html = Html;
