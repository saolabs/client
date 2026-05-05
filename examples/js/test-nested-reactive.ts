import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.test-nested-reactive';
const __VIEW_NAMESPACE__ = 'examples.';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: false,
    viewType: 'view',
    sections: {},
    wrapperConfig: { enable: false, tag: null, subscribe: true, attributes: {} },
    hasAwaitData: false,
    hasFetchData: false,
    usesVars: false,
    hasSections: false,
    hasSectionPreload: false,
    hasPrerender: false,
    renderLongSections: [],
    renderSections: [],
    prerenderSections: []
};



class TestNestedReactiveViewController extends ViewController {
    constructor(view: View) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this as any).setStaticConfig === 'function') {
            (this as any).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this as any).config = __VIEW_CONFIG__;
        }
    }
}

class TestNestedReactiveView extends View {
    constructor(__data__: any = {}, systemData: any = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, TestNestedReactiveViewController);
        const App: Application = app("App") as Application;
        const __STATE__ = this.__ctrl__.states;
        const {__base__, __layout__, __page__, __component__, __template__, __context__, __partial__, __system__, __env = {}, __helper = {}} = systemData;
        const __VIEW_ID__ = __data__.__SSR_VIEW_ID__ || App.View.generateViewId();

        const useState = (value: any) => {
            return __STATE__.__useState(value);
        };
        const updateRealState = (state: any) => {
            __STATE__.__.updateRealState(state);
        };

        const lockUpdateRealState = () => {
            __STATE__.__.lockUpdateRealState();
        };
        const updateStateByKey = (key: string, state: any) => {
            __STATE__.__.updateStateByKey(key, state);
        };


        const __UPDATE_DATA_TRAIT__: any = {};
        const set$items = __STATE__.__.register('items');
        let items: any = null;
        const setItems = (state: any) => {
            items = state;
            set$items(state);
        };
        __STATE__.__.setters.setItems = setItems;
        __STATE__.__.setters.items = setItems;
        const update$items = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('items', value);
                items = value;
            }
        };
        const set$status = __STATE__.__.register('status');
        let status: any = null;
        const setStatus = (state: any) => {
            status = state;
            set$status(state);
        };
        __STATE__.__.setters.setStatus = setStatus;
        __STATE__.__.setters.status = setStatus;
        const update$status = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('status', value);
                status = value;
            }
        };
        const set$count = __STATE__.__.register('count');
        let count: any = null;
        const setCount = (state: any) => {
            count = state;
            set$count(state);
        };
        __STATE__.__.setters.setCount = setCount;
        __STATE__.__.setters.count = setCount;
        const update$count = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('count', value);
                count = value;
            }
        };
        const set$showDetails = __STATE__.__.register('showDetails');
        let showDetails: any = null;
        const setShowDetails = (state: any) => {
            showDetails = state;
            set$showDetails(state);
        };
        __STATE__.__.setters.setShowDetails = setShowDetails;
        __STATE__.__.setters.showDetails = setShowDetails;
        const update$showDetails = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('showDetails', value);
                showDetails = value;
            }
        };
        const __VARIABLE_LIST__: any = [];


        this.__ctrl__.setUserDefinedConfig({
            data: {},
                addItem() {
                    setItems([...items, {
                        id: items.length + 1,
                        name: 'New Item',
                        category: 'fruit',
                        price: 5,
                        tags: ['new']
                    }]);
                },
                toggleDetails() {
                    setShowDetails(!showDetails);
                },
                incrementCount() {
                    setCount(count + 1);
                },
                changeStatus(newStatus: string) {
                    setStatus(newStatus);
                }
        });

        this.__ctrl__.setup({
            superView: null,
            subscribe: true,
            fetch: null,
            data: __data__,
            viewId: __VIEW_ID__,
            path: __VIEW_PATH__,
            scripts: [],
            styles: [],
            resources: [],
            commitConstructorData: function(this: any) {
                // Then update states from data
                update$items([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
                update$status('active');
                update$count(0);
                update$showDetails(true);
                // Finally lock state updates
                lockUpdateRealState();
            },
            updateVariableData: function(this: any, data: any) {
                // Update all variables first
                for (const key in data) {
                    if (data.hasOwnProperty(key)) {
                        // Call updateVariableItemData directly from config
                        if (typeof this.config.updateVariableItemData === 'function') {
                            this.config.updateVariableItemData.call(this, key, data[key]);
                        }
                    }
                }
                // Then update states from data
                update$items([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
                update$status('active');
                update$count(0);
                update$showDetails(true);
                // Finally lock state updates
                lockUpdateRealState();
            },
            updateVariableItemData: function(this: any, key: string, value: any) {
                this.data[key] = value;
                if (typeof __UPDATE_DATA_TRAIT__[key] === "function") {
                    __UPDATE_DATA_TRAIT__[key](value);
                }
            },
            prerender: function() {
            return null;
            },
            render: function () {
            let parentElement = this.parentElement;
            let parentReactive = null;
            return this.wrapper((parentElement: any) => [
            this.html(`div-1`, "div", parentElement,
                { classes: [{ type: 'static', value: "nested-reactive-demo" }] },
                (parentElement: any) => [
                this.html(`div-1-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                    this.text('Total items: '),
                    this.output(`div-1-h2-1-output-1`, parentElement, true, ["items"], (parentElement: any) => App.Helper.count(items))
                ]),
                this.html(`div-1-p-2`, "p", parentElement, {}, (parentElement: any) => [
                    this.text('Status: '),
                    this.output(`div-1-p-2-output-1`, parentElement, true, ["status"], (parentElement: any) => status)
                ]),
                this.reactive(`div-1-rc-if-1`, "if", parentReactive, parentElement, ["showDetails"], (parentReactive: any, parentElement: any) => {
                    const reactiveContents = [];
                    if (showDetails) {
                        reactiveContents.push(
                        this.html(`div-1-rc-if-1-case_1-div-1`, "div", parentElement,
                            { classes: [{ type: 'static', value: "details-panel" }] },
                            (parentElement: any) => [
                            this.html(`div-1-rc-if-1-case_1-div-1-h3-1`, "h3", parentElement, {}, (parentElement: any) => [
                                this.text('Item Details (count: '),
                                this.output(`div-1-rc-if-1-case_1-div-1-h3-1-output-1`, parentElement, true, ["count"], (parentElement: any) => count),
                                this.text(')')
                            ]),
                            this.reactive(`div-1-rc-if-1-case_1-div-1-foreach-1`, "foreach", parentReactive, parentElement, ["items"], (parentReactive: any, parentElement: any) => {
                                return this.__foreach(items, (item: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                    this.html(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1`, "div", parentElement,
                                        { classes: [{ type: 'static', value: "item-card" }], attrs: { "data-id": { type: 'binding', value: `${item.id}`, factory: () => `${item.id}`, stateKeys: [] } } },
                                        (parentElement: any) => [
                                        this.html(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-strong-1`, "strong", parentElement, {}, (parentElement: any) => [
                                            this.output(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-strong-1-output-1`, parentElement, true, [], (parentElement: any) => item.name)
                                        ]),
                                        this.text(' - $'),
                                        this.output(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-output-1`, parentElement, true, [], (parentElement: any) => item.price),
                                        this.reactive(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                            const reactiveContents = [];
                                            if (item.price > 2) {
                                                reactiveContents.push(
                                                this.html(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-rc-if-1-case_1-span-1`, "span", parentElement,
                                                    { classes: [{ type: 'static', value: "badge" }, { type: 'static', value: "expensive" }] },
                                                    (parentElement: any) => [
                                                    this.text('Expensive')
                                                    ])
                                                );
                                            }
                                            else {
                                                reactiveContents.push(
                                                this.html(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-rc-if-1-case_2-span-1`, "span", parentElement,
                                                    { classes: [{ type: 'static', value: "badge" }, { type: 'static', value: "cheap" }] },
                                                    (parentElement: any) => [
                                                    this.text('Affordable')
                                                    ])
                                                );
                                            }
                                            return reactiveContents;
                                        }),
                                        this.html(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-div-2`, "div", parentElement,
                                            { classes: [{ type: 'static', value: "tags" }] },
                                            (parentElement: any) => [
                                            this.__foreach(item.tags, (tag: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                                    this.html(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-div-2-foreach-1-${__loopIndex}-span-1`, "span", parentElement,
                                                        { classes: [{ type: 'static', value: "tag" }] },
                                                        (parentElement: any) => [
                                                        this.output(`div-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-div-1-div-2-foreach-1-${__loopIndex}-span-1-output-1`, parentElement, true, [], (parentElement: any) => tag)
                                                        ])
                                            ])
                                            ])
                                        ])
                                ])
                            })
                            ])
                        );
                    }
                    else {
                        reactiveContents.push(
                        this.html(`div-1-rc-if-1-case_2-p-1`, "p", parentElement, {}, (parentElement: any) => [
                            this.text('Details hidden. Click to show.')
                        ])
                        );
                    }
                    return reactiveContents;
                }),
                this.reactive(`div-1-rc-switch-2`, "switch", parentReactive, parentElement, ["status"], (parentReactive: any, parentElement: any) => {
                    const reactiveContents = [];
                    switch (status) {
                        case 'active':
                            reactiveContents.push(
                            this.html(`div-1-rc-switch-2-case_1-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "status-active" }] },
                                (parentElement: any) => [
                                this.html(`div-1-rc-switch-2-case_1-div-1-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                    this.text('System is active')
                                ]),
                                this.reactive(`div-1-rc-switch-2-case_1-div-1-for-1`, "for", parentReactive, parentElement, ["count"], (parentReactive: any, parentElement: any) => {
                                    return this.__for("increment", 0, count, (__loop: any) => {
                                        let __forOutput = [];
                                        for (let i = 0; i < count; i++) {
                                            __loop.setCurrentTimes(i);
                                            __forOutput.push(
                                            this.html(`div-1-rc-switch-2-case_1-div-1-for-1-${i}-div-1`, "div", parentElement,
                                                { classes: [{ type: 'static', value: "counter-item" }] },
                                                (parentElement: any) => [
                                                this.text('Item #'),
                                                this.output(`div-1-rc-switch-2-case_1-div-1-for-1-${i}-div-1-output-1`, parentElement, true, ["i"], (parentElement: any) => i + 1),
                                                this.reactive(`div-1-rc-switch-2-case_1-div-1-for-1-${i}-div-1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                                    const reactiveContents = [];
                                                    if (i % 2 === 0) {
                                                        reactiveContents.push(
                                                        this.html(`div-1-rc-switch-2-case_1-div-1-for-1-${i}-div-1-rc-if-1-case_1-span-1`, "span", parentElement, {}, (parentElement: any) => [
                                                            this.text('(even)')
                                                        ])
                                                        );
                                                    }
                                                    else {
                                                        reactiveContents.push(
                                                        this.html(`div-1-rc-switch-2-case_1-div-1-for-1-${i}-div-1-rc-if-1-case_2-span-1`, "span", parentElement, {}, (parentElement: any) => [
                                                            this.text('(odd)')
                                                        ])
                                                        );
                                                    }
                                                    return reactiveContents;
                                                })
                                                ])
                                            );
                                        }
                                        return __forOutput;
                                    })
                                })
                                ])
                            );
                            break;
                        case 'inactive':
                            reactiveContents.push(
                            this.html(`div-1-rc-switch-2-case_2-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "status-inactive" }] },
                                (parentElement: any) => [
                                this.html(`div-1-rc-switch-2-case_2-div-1-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                    this.text('System is inactive')
                                ])
                                ])
                            );
                            break;
                        default:
                            reactiveContents.push(
                            this.html(`div-1-rc-switch-2-case_3-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "status-unknown" }] },
                                (parentElement: any) => [
                                this.html(`div-1-rc-switch-2-case_3-div-1-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                    this.text('Unknown status: '),
                                    this.output(`div-1-rc-switch-2-case_3-div-1-p-1-output-1`, parentElement, true, ["status"], (parentElement: any) => status)
                                ])
                                ])
                            );
                            break;
                    }
                    return reactiveContents;
                }),
                this.html(`div-1-div-3`, "div", parentElement,
                    { classes: [{ type: 'static', value: "category-groups" }] },
                    (parentElement: any) => [
                    this.reactive(`div-1-div-3-foreach-1`, "foreach", parentReactive, parentElement, ["items"], (parentReactive: any, parentElement: any) => {
                        return this.__foreach(items, (item: any, key: any, __loopIndex: any, __loop: any) => [
                            this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "group" }] },
                                (parentElement: any) => [
                                this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-h4-1`, "h4", parentElement, {}, (parentElement: any) => [
                                    this.text('['),
                                    this.output(`div-1-div-3-foreach-1-${__loopIndex}-div-1-h4-1-output-1`, parentElement, true, [], (parentElement: any) => key),
                                    this.text('] '),
                                    this.output(`div-1-div-3-foreach-1-${__loopIndex}-div-1-h4-1-output-2`, parentElement, true, [], (parentElement: any) => item.name),
                                    this.text(' ('),
                                    this.output(`div-1-div-3-foreach-1-${__loopIndex}-div-1-h4-1-output-3`, parentElement, true, [], (parentElement: any) => item.category),
                                    this.text(')')
                                ]),
                                this.reactive(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-switch-1`, "switch", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                    const reactiveContents = [];
                                    switch (item.category) {
                                        case 'fruit':
                                            reactiveContents.push(
                                            this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-switch-1-case_1-span-1`, "span", parentElement,
                                                { classes: [{ type: 'static', value: "icon" }] },
                                                (parentElement: any) => [
                                                this.text('🍎')
                                                ])
                                            );
                                            break;
                                        case 'vegetable':
                                            reactiveContents.push(
                                            this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-switch-1-case_2-span-1`, "span", parentElement,
                                                { classes: [{ type: 'static', value: "icon" }] },
                                                (parentElement: any) => [
                                                this.text('🥦')
                                                ])
                                            );
                                            break;
                                    }
                                    return reactiveContents;
                                }),
                                this.reactive(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                    const reactiveContents = [];
                                    if (App.Helper.count(item.tags) > 1) {
                                        reactiveContents.push(
                                        this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_1-ul-1`, "ul", parentElement, {}, (parentElement: any) => [
                                            this.__foreach(item.tags, (tag: any, idx: any, __loopIndex: any, __loop: any) => [
                                                    this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_1-ul-1-foreach-1-${__loopIndex}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                                        this.text('Tag '),
                                                        this.output(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_1-ul-1-foreach-1-${__loopIndex}-li-1-output-1`, parentElement, true, [], (parentElement: any) => idx),
                                                        this.text(': '),
                                                        this.output(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_1-ul-1-foreach-1-${__loopIndex}-li-1-output-2`, parentElement, true, [], (parentElement: any) => tag),
                                                        this.reactive(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_1-ul-1-foreach-1-${__loopIndex}-li-1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                                            const reactiveContents = [];
                                                            if (tag === 'sweet') {
                                                                reactiveContents.push(
                                                                this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_1-ul-1-foreach-1-${__loopIndex}-li-1-rc-if-1-case_1-em-1`, "em", parentElement, {}, (parentElement: any) => [
                                                                    this.text(' ← popular!')
                                                                ])
                                                                );
                                                            }
                                                            return reactiveContents;
                                                        })
                                                    ])
                                            ])
                                        ])
                                        );
                                    }
                                    else {
                                        reactiveContents.push(
                                        this.html(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_2-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                            this.text('Only one tag: '),
                                            this.output(`div-1-div-3-foreach-1-${__loopIndex}-div-1-rc-if-2-case_2-p-1-output-1`, parentElement, true, [], (parentElement: any) => item.tags[0])
                                        ])
                                        );
                                    }
                                    return reactiveContents;
                                })
                                ])
                        ])
                    })
                    ]),
                this.include("div-1-component-1", components.item-card, parentElement, [], (parentElement: any) => ({"items": items, "count": count}))
                ])
            ]);
            }
        });

    }
}

// Export factory function
export function TestNestedReactive(__data__ = {}, systemData = {}): TestNestedReactiveView {
    return new TestNestedReactiveView(__data__, systemData);
}
export default TestNestedReactive;
