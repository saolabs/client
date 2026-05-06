import { ESK, InitMode, InitModes } from "../contracts/common";
import type { HtmlInterface, OneChildrenFactory, OneChildrenFactoryOutput, OneElementChildren, OneElementConfig } from "../contracts/ElementInterface";
import type { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import type { ViewManagerInterface } from "../contracts/ViewManagerInterface";
import { hasData } from "../helpers/utils";
import type { OneObjectType } from "../types/utils";

export class Html implements HtmlInterface {
    oneType: OneObjectType = 'Html';
    public element: HTMLElement;
    public parent: HtmlInterface | null;
    private tagName: string;
    private config: OneElementConfig;
    private ctx: ViewControllerInterface | ViewManagerInterface;
    private children: OneElementChildren = [];

    public domChildren: Node[] = []; // For compatibility with HtmlInterface; Html itself doesn't have a single root element
    private childrenFactory: OneChildrenFactory | null = null;
    private abortController: AbortController = new AbortController();

    /** All state subscriptions for reactive bindings — cleanup on destroy */
    private bindingUnsubscribes: (() => void)[] = [];
    public initMode: InitMode = InitModes.CREATE;

    constructor({
        ctx,
        id = null,
        parentElement = null,
        tagName = 'div',
        element = null,
        config = {},
        childrenFactory = null,
        initMode = InitModes.CREATE,
    }: {
        ctx: ViewControllerInterface | ViewManagerInterface,
        id?: string | null,
        parentElement?: HtmlInterface | null,
        tagName?: string,
        element?: HTMLElement | null,
        config?: OneElementConfig,
        childrenFactory?: OneChildrenFactory | null,
        initMode?: InitMode;
    }) {


        this.ctx = ctx;
        this.parent = parentElement;
        this.config = config;
        this.tagName = tagName;
        this.initMode = initMode;
        const shouldHydrate = config.hydrate && initMode === InitModes.HYDRATE;

        const onlySync = (initMode === InitModes.HYDRATE && config.element instanceof HTMLElement) || element instanceof HTMLElement;
        if (onlySync) {
            this.element = element || config.element as HTMLElement;
            this.tagName = this.element.tagName.toLowerCase();
        } else if (shouldHydrate && config.selector) {
            const found = document.querySelector(`${tagName}.${id}`) as HTMLElement | null;
            if (found instanceof HTMLElement) {
                this.element = found;
                this.tagName = found.tagName.toLowerCase();
            } else {
                this.element = document.createElement(tagName);
                this.element.classList.add(id || '');
                console.warn(`[Html] Selector "${config.selector}" not found, created new <${tagName}>.`);
            }
        } else {
            this.element = document.createElement(this.tagName);
            this.element.classList.add(id || '');
            if (shouldHydrate) {
                console.warn(`[Html] No selector for hydration, created new <${tagName}>.`);
            }
        }



        this.childrenFactory = childrenFactory;
        this.initialize();
    }

    updateConfig(newConfig: Partial<OneElementConfig>): void {
        if(hasData(newConfig)){
            this.config = { ...this.config, ...newConfig };
        }
    }

    private initialize() {
        this.initializeAttributes();
        this.initializeClasses();
        this.initializeStyles();
        this.initializeEvents();
    }



    private initializeAttributes() {
        if (this.config.attrs) {
            for (const [attrName, attrConfig] of Object.entries(this.config.attrs)) {
                if (attrConfig.type === 'value') {
                    this.element.setAttribute(attrName, attrConfig.value);
                } else if (attrConfig.type === 'binding') {
                    const value = attrConfig.factory ? attrConfig.factory() : '';
                    if (value !== undefined && value !== null && value !== false) {
                        this.element.setAttribute(attrName, String(value));
                    } else {
                        this.element.removeAttribute(attrName);
                    }

                    // Reactive binding for attributes
                    if (attrConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(
                            attrConfig.stateKeys,
                            () => {
                                const newValue = attrConfig.factory ? attrConfig.factory() : '';
                                if (newValue !== undefined && newValue !== null && newValue !== false) {
                                    this.element.setAttribute(attrName, String(newValue));
                                } else {
                                    this.element.removeAttribute(attrName);
                                }
                            }
                        );
                        this.bindingUnsubscribes.push(unsubscribe);
                    }
                }
            }
        }
        if (this.config.props) {
            for (const [propName, propConfig] of Object.entries(this.config.props)) {
                if (propConfig.type === 'value') {
                    (this.element as any)[propName] = propConfig.value;
                } else if (propConfig.type === 'binding') {
                    const value = propConfig.factory ? propConfig.factory() : '';
                    if (value !== undefined && value !== null && value !== false) {
                        (this.element as any)[propName] = value;
                    } else {
                        (this.element as any)[propName] = false;
                        delete (this.element as any)[propName];
                    }

                    // Reactive binding for properties
                    if (propConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(
                            propConfig.stateKeys,
                            () => {
                                const newValue = propConfig.factory ? propConfig.factory() : '';
                                if (newValue !== undefined && newValue !== null && newValue !== false) {
                                    (this.element as any)[propName] = newValue;
                                } else {
                                    (this.element as any)[propName] = false;
                                    delete (this.element as any)[propName];
                                }
                            }
                        );
                        this.bindingUnsubscribes.push(unsubscribe);
                    }
                }
            }
        }
    }

    private initializeClasses(): void {
        if (!this.config.classes) return;

        // New simplified format: classes: [{ type, value, factory?, stateKeys? }]
        if (Array.isArray(this.config.classes)) {
            for (const classConfig of this.config.classes) {
                if (!classConfig || !classConfig.value) continue;
                const className = classConfig.value;

                if (classConfig.type === 'static') {
                    this.element.classList.add(className);
                    continue;
                }

                if (classConfig.type === 'binding') {
                    const initialValue = classConfig.factory ? classConfig.factory() : false;
                    this.element.classList.toggle(className, !!initialValue);

                    if (classConfig.stateKeys?.length) {
                        const unsubscribe = this.ctx.states.__.subscribe(
                            classConfig.stateKeys,
                            () => {
                                const newValue = classConfig.factory ? classConfig.factory() : false;
                                this.element.classList.toggle(className, !!newValue);
                            }
                        );
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
            } else if (classConfig.type === 'binding') {
                // Initial value
                const initialValue = classConfig.factory ? classConfig.factory() : !!classConfig.value;
                this.element.classList.toggle(className, !!initialValue);

                // Subscribe for reactive updates
                if (classConfig.stateKeys?.length) {
                    const unsubscribe = this.ctx.states.__.subscribe(
                        classConfig.stateKeys,
                        () => {
                            const newValue = classConfig.factory ? classConfig.factory() : false;
                            this.element.classList.toggle(className, !!newValue);
                        }
                    );
                    this.bindingUnsubscribes.push(unsubscribe);
                }
            }
        }
    }

    private initializeStyles(): void {
        if (!this.config.styles) return;

        for (const [prop, styleConfig] of Object.entries(this.config.styles)) {
            if (styleConfig.type === 'value') {
                this.element.style.setProperty(prop, styleConfig.value ?? '');
            } else if (styleConfig.type === 'binding') {
                // Initial value
                const initialValue = styleConfig.factory ? styleConfig.factory() : (styleConfig.value ?? '');
                this.element.style.setProperty(prop, initialValue);

                // Subscribe for reactive updates
                if (styleConfig.stateKeys?.length) {
                    const unsubscribe = this.ctx.states.__.subscribe(
                        styleConfig.stateKeys,
                        () => {
                            const newValue = styleConfig.factory ? styleConfig.factory() : '';
                            this.element.style.setProperty(prop, newValue);
                        }
                    );
                    this.bindingUnsubscribes.push(unsubscribe);
                }
            }
        }
    }

    private initializeEvents() {
        if (this.config.events) {
            for (const [eventName, handlers] of Object.entries(this.config.events)) {
                this.ctx.addEventListener(this.element, eventName, handlers);
            }
        }
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    setParent(parent: HtmlInterface | null): void {
        this.parent = parent;
    }
    setChildrenFactory(factory: OneChildrenFactory): void {
        this.childrenFactory = factory;
    }

    isSingleElement(): boolean {
        return ['input', 'img', 'br', 'hr', 'meta', 'link'].includes(this.tagName.toLowerCase());
    }

    render(): HTMLElement {
        if (this.isSingleElement()) {
            return this.element;
        }
        let children: OneChildrenFactoryOutput = [];
        if (this.childrenFactory) {
            // Compiled output uses (parentElement) => [...] — pass `this` as parentElement
            children = this.childrenFactory(this);
        }
        // CLEAR EXISTING CONTENT BEFORE RENDERING NEW CHILDREN
        this.element.innerHTML = ''; // Clear existing content before rendering children

        if (children && children.length > 0) {
            children.forEach(child => {
                if (typeof child === 'string' || typeof child === 'number') {
                    const textNode = document.createTextNode(String(child));
                    this.element.appendChild(textNode);
                    this.children.push(textNode);
                } else if (child && typeof child === 'object') {
                    if ('element' in child) {
                        // HtmlInterface, TextInterface
                        this.element.appendChild(child.element);
                        this.children.push(child);
                        child.render();
                    } else if ('openTag' in child && 'closeTag' in child) {
                        // Output, Reactive, Fragment, BlockOutlet — they self-append markers
                        if ('parent' in child) {
                            (child as any).parent = this;
                        }
                        if ('parentElement' in child) {
                            (child as any).parentElement = this;
                        }
                        this.children.push(child);
                        child.render();
                    }
                }
            });
        }
        return this.element;
    }

    /** Start reactive bindings + children (Phase 2 lifecycle) */
    start(): void {
        for (const child of this.children) {
            if ('start' in child && typeof (child as any).start === 'function') {
                (child as any).start();
            }
        }
    }

    /** Stop reactive bindings + children */
    stop(): void {
        for (const child of this.children) {
            if ('stop' in child && typeof (child as any).stop === 'function') {
                (child as any).stop();
            }
        }
    }

    

    clearHTML(): void {
        this.element.innerHTML = '';
    }

    remove() {
        this.element.remove();
    }

    destroy() {
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
    }

    get isOneElement(): boolean {
        return true;
    }
    set isOneElement(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Html elements
    }

    get isOneHtml(): boolean {
        return true;
    }
    set isOneHtml(value: boolean) {
        // No-op setter to satisfy the Interface; this property is always true for Html elements
    }
}
