import { View, ViewController, app, Application } from 'saola';

import { ref } from 'saola';



const __VIEW_PATH__ = 'examples.input';
const __VIEW_NAMESPACE__ = 'examples.';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: false,
    viewType: 'view',
    sections: {},
    wrapperConfig: { enable: false, tag: null, subscribe: true, attributes: {} },
    hasAwaitData: false,
    hasFetchData: false,
    usesVars: true,
    hasSections: false,
    hasSectionPreload: false,
    hasPrerender: false,
    renderLongSections: [],
    renderSections: [],
    prerenderSections: []
};



class InputViewController extends ViewController {
    constructor(view: View) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this as any).setStaticConfig === 'function') {
            (this as any).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this as any).config = __VIEW_CONFIG__;
        }
    }
}

class InputView extends View {
    constructor(__data__: any = {}, systemData: any = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, InputViewController);
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
        let {users, posts} = __data__;
        const set$editMode = __STATE__.__.register('editMode');
        let editMode: any = null;
        const setEditMode = (state: any) => {
            editMode = state;
            set$editMode(state);
        };
        __STATE__.__.setters.setEditMode = setEditMode;
        __STATE__.__.setters.editMode = setEditMode;
        const update$editMode = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('editMode', value);
                editMode = value;
            }
        };
        const set$todos = __STATE__.__.register('todos');
        let todos: any = null;
        const setTodos = (state: any) => {
            todos = state;
            set$todos(state);
        };
        __STATE__.__.setters.setTodos = setTodos;
        __STATE__.__.setters.todos = setTodos;
        const update$todos = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('todos', value);
                todos = value;
            }
        };
        const set$newTodo = __STATE__.__.register('newTodo');
        let newTodo: any = null;
        const setNewTodo = (state: any) => {
            newTodo = state;
            set$newTodo(state);
        };
        __STATE__.__.setters.setNewTodo = setNewTodo;
        __STATE__.__.setters.newTodo = setNewTodo;
        const update$newTodo = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('newTodo', value);
                newTodo = value;
            }
        };
        const set$nextTodoIndex = __STATE__.__.register('nextTodoIndex');
        let nextTodoIndex: any = null;
        const setNextTodoIndex = (state: any) => {
            nextTodoIndex = state;
            set$nextTodoIndex(state);
        };
        __STATE__.__.setters.setNextTodoIndex = setNextTodoIndex;
        __STATE__.__.setters.nextTodoIndex = setNextTodoIndex;
        const update$nextTodoIndex = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('nextTodoIndex', value);
                nextTodoIndex = value;
            }
        };
        const set$products = __STATE__.__.register('products');
        let products: any = null;
        const setProducts = (state: any) => {
            products = state;
            set$products(state);
        };
        __STATE__.__.setters.setProducts = setProducts;
        __STATE__.__.setters.products = setProducts;
        const update$products = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('products', value);
                products = value;
            }
        };
        const set$inventory = __STATE__.__.register('inventory');
        let inventory: any = null;
        const setInventory = (state: any) => {
            inventory = state;
            set$inventory(state);
        };
        __STATE__.__.setters.setInventory = setInventory;
        __STATE__.__.setters.inventory = setInventory;
        const update$inventory = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('inventory', value);
                inventory = value;
            }
        };
        const set$catalog = __STATE__.__.register('catalog');
        let catalog: any = null;
        const setCatalog = (state: any) => {
            catalog = state;
            set$catalog(state);
        };
        __STATE__.__.setters.setCatalog = setCatalog;
        __STATE__.__.setters.catalog = setCatalog;
        const update$catalog = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('catalog', value);
                catalog = value;
            }
        };
        const MAX_COUNT = 10;
        let n = 0;
        __UPDATE_DATA_TRAIT__.users = (value: any) => users = value;
        __UPDATE_DATA_TRAIT__.posts = (value: any) => posts = value;
        __UPDATE_DATA_TRAIT__.n = (value: any) => n = value;
        const __VARIABLE_LIST__: any = ["users", "posts", "n"];


        this.__ctrl__.setUserDefinedConfig({
            methods: {
                    handleNewTodoKeyDown(event: KeyboardEvent) {
                        if (event.key === 'Enter') {
                            this.addTodo();
                        }
                    },
                    addTodo() {
                        if (this.newTodo.trim() !== '') {
                            this.todos.push({
                                id: this.nextTodoIndex,
                                task: this.newTodo.trim(),
                                completed: false
                            });
                            this.nextTodoIndex++;
                            this.newTodo = '';
                        }
                    }
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
                update$editMode(false);
                update$todos([{"id": 1, "task": "Buy groceries", "completed": false}, {"id": 2, "task": "Walk the dog", "completed": true}, {"id": 3, "task": "Read a book", "completed": false}]);
                update$newTodo('');
                update$nextTodoIndex(4);
                update$products([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
                update$inventory([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
                update$catalog([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
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
                update$editMode(false);
                update$todos([{"id": 1, "task": "Buy groceries", "completed": false}, {"id": 2, "task": "Walk the dog", "completed": true}, {"id": 3, "task": "Read a book", "completed": false}]);
                update$newTodo('');
                update$nextTodoIndex(4);
                update$products([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
                update$inventory([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
                update$catalog([{"id": 1, "name": "Apple", "category": "fruit", "price": 2, "tags": ["red", "sweet"]}, {"id": 2, "name": "Carrot", "category": "vegetable", "price": 1, "tags": ['orange']}, {"id": 3, "name": "Banana", "category": "fruit", "price": 3, "tags": ["yellow", "sweet", "tropical"]}, {"id": 4, "name": "Broccoli", "category": "vegetable", "price": 4, "tags": ["green", "healthy"]}]);
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
                { classes: [{ type: 'static', value: "input-demo" }] },
                (parentElement: any) => [
                this.html(`div-1-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                    this.text('Input State Demo')
                ]),
                this.html(`div-1-div-2`, "div", parentElement,
                    { classes: [{ type: 'static', value: "users" }] },
                    (parentElement: any) => [
                    this.html(`div-1-div-2-h3-1`, "h3", parentElement, {}, (parentElement: any) => [
                        this.text('Users')
                    ]),
                    this.html(`div-1-div-2-ul-2`, "ul", parentElement, {}, (parentElement: any) => [
                        this.__foreach(users, (user: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                this.html(`div-1-div-2-ul-2-foreach-1-${__loopIndex}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                    this.output(`div-1-div-2-ul-2-foreach-1-${__loopIndex}-li-1-output-1`, parentElement, true, [], (parentElement: any) => user.name),
                                    this.text(' ('),
                                    this.output(`div-1-div-2-ul-2-foreach-1-${__loopIndex}-li-1-output-2`, parentElement, true, [], (parentElement: any) => user.email),
                                    this.text(')')
                                ])
                        ])
                    ])
                    ]),
                this.html(`div-1-div-3`, "div", parentElement,
                    { classes: [{ type: 'static', value: "posts" }] },
                    (parentElement: any) => [
                    this.html(`div-1-div-3-h3-1`, "h3", parentElement, {}, (parentElement: any) => [
                        this.text('Posts')
                    ]),
                    this.html(`div-1-div-3-ul-2`, "ul", parentElement, {}, (parentElement: any) => [
                        this.__foreach(posts, (post: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                this.html(`div-1-div-3-ul-2-foreach-1-${__loopIndex}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                    this.html(`div-1-div-3-ul-2-foreach-1-${__loopIndex}-li-1-strong-1`, "strong", parentElement, {}, (parentElement: any) => [
                                        this.output(`div-1-div-3-ul-2-foreach-1-${__loopIndex}-li-1-strong-1-output-1`, parentElement, true, [], (parentElement: any) => post.title)
                                    ]),
                                    this.text(': '),
                                    this.output(`div-1-div-3-ul-2-foreach-1-${__loopIndex}-li-1-output-1`, parentElement, true, [], (parentElement: any) => post.content)
                                ])
                        ])
                    ])
                    ])
                ]),
            this.html(`div-2`, "div", parentElement,
                { classes: [{ type: 'static', value: "todos-demo" }] },
                (parentElement: any) => [
                this.html(`div-2-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                    this.text('Todos')
                ]),
                this.html(`div-2-ul-2`, "ul", parentElement, {}, (parentElement: any) => [
                    this.reactive(`div-2-ul-2-foreach-1`, "foreach", parentReactive, parentElement, ["todos"], (parentReactive: any, parentElement: any) => {
                        return this.__foreach(todos, (todo: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                            this.html(`div-2-ul-2-foreach-1-${__loopIndex}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                this.html(`div-2-ul-2-foreach-1-${__loopIndex}-li-1-label-1`, "label", parentElement, {}, (parentElement: any) => [
                                    this.html(`div-2-ul-2-foreach-1-${__loopIndex}-li-1-label-1-input-1`, "input", parentElement, { attrs: { "type": { type: 'static', value: "checkbox" }, "bind": { type: 'static', value: true }, "todo": { type: 'static', value: true }, "completed": { type: 'static', value: true }, "checked": { type: 'static', value: true } } }),
                                    this.output(`div-2-ul-2-foreach-1-${__loopIndex}-li-1-label-1-output-1`, parentElement, true, [], (parentElement: any) => todo.task)
                                ])
                            ])
                        ])
                    })
                ]),
                this.html(`div-2-div-3`, "div", parentElement,
                    { classes: [{ type: 'static', value: "is-edit-mode" }] },
                    (parentElement: any) => [
                    this.html(`div-2-div-3-input-1`, "input", parentElement, { attrs: { "type": { type: 'static', value: "text" }, "bind": { type: 'static', value: true }, "newTodo": { type: 'static', value: true }, "placeholder": { type: 'static', value: "Nhập công việc mới" } }, events: { keydown: [{"handler":"handleNewTodoKeyDown","params":[() => event]}] } }),
                    this.html(`div-2-div-3-button-2`, "button", parentElement,
                        { events: { click: [{"handler":"addTodo","params":[]}] } },
                        (parentElement: any) => [
                        this.text('+')
                        ])
                    ])
                ]),
            this.html(`div-3`, "div", parentElement,
                { classes: [{ type: 'static', value: "products-demo" }] },
                (parentElement: any) => [
                this.html(`div-3-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                    this.text('Products '),
                    this.output(`div-3-h2-1-output-1`, parentElement, true, ["products"], (parentElement: any) => App.Helper.count(products))
                ]),
                this.reactive(`div-3-rc-if-1`, "if", parentReactive, parentElement, ["products"], (parentReactive: any, parentElement: any) => {
                    const reactiveContents = [];
                    if (App.Helper.count(products) === 0) {
                        reactiveContents.push(
                        this.html(`div-3-rc-if-1-case_1-p-1`, "p", parentElement, {}, (parentElement: any) => [
                            this.text('No products available.')
                        ])
                        );
                    }
                    else {
                        reactiveContents.push(
                        this.html(`div-3-rc-if-1-case_2-ul-1`, "ul", parentElement, {}, (parentElement: any) => [
                            this.reactive(`div-3-rc-if-1-case_2-ul-1-foreach-1`, "foreach", parentReactive, parentElement, ["products"], (parentReactive: any, parentElement: any) => {
                                return this.__foreach(products, (product: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                    this.html(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                        this.output(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1-output-1`, parentElement, true, [], (parentElement: any) => product.name),
                                        this.text(' - $'),
                                        this.output(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1-output-2`, parentElement, true, [], (parentElement: any) => product.price),
                                        this.reactive(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                            const reactiveContents = [];
                                            if (product.tags && App.Helper.count(product.tags) > 0) {
                                                reactiveContents.push(
                                                this.html(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1-rc-if-1-case_1-div-1`, "div", parentElement,
                                                    { classes: [{ type: 'static', value: "tags" }] },
                                                    (parentElement: any) => [
                                                    this.__foreach(product.tags, (tag: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                                            this.html(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-span-1`, "span", parentElement,
                                                                { classes: [{ type: 'static', value: "tag" }] },
                                                                (parentElement: any) => [
                                                                this.output(`div-3-rc-if-1-case_2-ul-1-foreach-1-${__loopIndex}-li-1-rc-if-1-case_1-div-1-foreach-1-${__loopIndex}-span-1-output-1`, parentElement, true, [], (parentElement: any) => tag)
                                                                ])
                                                    ])
                                                    ])
                                                );
                                            }
                                            return reactiveContents;
                                        })
                                    ])
                                ])
                            })
                        ])
                        );
                    }
                    return reactiveContents;
                })
                ]),
            this.html(`div-4`, "div", parentElement,
                { classes: [{ type: 'static', value: "for-loop" }] },
                (parentElement: any) => [
                this.html(`div-4-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                    this.text('Inventory (For Loop Demo)')
                ]),
                this.html(`div-4-ul-2`, "ul", parentElement, {}, (parentElement: any) => [
                    this.reactive(`div-4-ul-2-for-1`, "for", parentReactive, parentElement, ["inventory"], (parentReactive: any, parentElement: any) => {
                        return this.__for("increment", 0, App.Helper.count(inventory), (__loop: any) => {
                            let __forOutput = [];
                            for (let i = 0; i < App.Helper.count(inventory); i++) {
                                __loop.setCurrentTimes(i);
                                __forOutput.push(
                                this.html(`div-4-ul-2-for-1-${i}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                    this.output(`div-4-ul-2-for-1-${i}-li-1-output-1`, parentElement, true, ["inventory"], (parentElement: any) => inventory[i].name),
                                    this.text(' - $'),
                                    this.output(`div-4-ul-2-for-1-${i}-li-1-output-2`, parentElement, true, ["inventory"], (parentElement: any) => inventory[i].price),
                                    this.reactive(`div-4-ul-2-for-1-${i}-li-1-rc-if-1`, "if", parentReactive, parentElement, ["inventory"], (parentReactive: any, parentElement: any) => {
                                        const reactiveContents = [];
                                        if (inventory[i].tags && App.Helper.count(inventory[i].tags) > 0) {
                                            reactiveContents.push(
                                            this.html(`div-4-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1`, "div", parentElement,
                                                { classes: [{ type: 'static', value: "tags" }] },
                                                (parentElement: any) => [
                                                this.reactive(`div-4-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1-for-1`, "for", parentReactive, parentElement, ["inventory"], (parentReactive: any, parentElement: any) => {
                                                    return this.__for("increment", 0, App.Helper.count(inventory[i].tags), (__loop: any) => {
                                                        let __forOutput = [];
                                                        for (let j = 0; j < App.Helper.count(inventory[i].tags); j++) {
                                                            __loop.setCurrentTimes(j);
                                                            __forOutput.push(
                                                            this.html(`div-4-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1-for-1-${j}-span-1`, "span", parentElement,
                                                                { classes: [{ type: 'static', value: "tag" }] },
                                                                (parentElement: any) => [
                                                                this.output(`div-4-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1-for-1-${j}-span-1-output-1`, parentElement, true, ["inventory"], (parentElement: any) => inventory[i].tags[j])
                                                                ])
                                                            );
                                                        }
                                                        return __forOutput;
                                                    })
                                                })
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
                ]),
            this.html(`div-5`, "div", parentElement,
                { classes: [{ type: 'static', value: "while-loop" }] },
                (parentElement: any) => {
                    const __execArr = [];
                    __execArr.push(
                        this.html(`div-5-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                            this.text('Catalog (While Loop Demo)')
                        ])
                    );
                    __execArr.push(
                        this.html(`div-5-ul-2`, "ul", parentElement, {}, (parentElement: any) => [
                            this.__for("increment", 0, MAX_COUNT, (__loop: any) => {
                                    let __forOutput = [];
                                    for (let i = 0; i < MAX_COUNT; i++) {
                                        __loop.setCurrentTimes(i);
                                        __forOutput.push(
                                        this.reactive(`div-5-ul-2-for-1-${i}-rc-if-1`, "if", parentReactive, parentElement, ["catalog"], (parentReactive: any, parentElement: any) => {
                                            const reactiveContents = [];
                                            if (i >= App.Helper.count(catalog)) {
                                            }
                                            return reactiveContents;
                                        }),
                                        this.html(`div-5-ul-2-for-1-${i}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                            this.output(`div-5-ul-2-for-1-${i}-li-1-output-1`, parentElement, true, ["catalog"], (parentElement: any) => catalog[i].name),
                                            this.text(' - $'),
                                            this.output(`div-5-ul-2-for-1-${i}-li-1-output-2`, parentElement, true, ["catalog"], (parentElement: any) => catalog[i].price),
                                            this.reactive(`div-5-ul-2-for-1-${i}-li-1-rc-if-1`, "if", parentReactive, parentElement, ["catalog"], (parentReactive: any, parentElement: any) => {
                                                const reactiveContents = [];
                                                if (catalog[i].tags && App.Helper.count(catalog[i].tags) > 0) {
                                                    reactiveContents.push(
                                                    this.html(`div-5-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1`, "div", parentElement,
                                                        { classes: [{ type: 'static', value: "tags" }] },
                                                        (parentElement: any) => [
                                                        this.reactive(`div-5-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1-for-1`, "for", parentReactive, parentElement, ["catalog"], (parentReactive: any, parentElement: any) => {
                                                            return this.__for("increment", 0, App.Helper.count(catalog[i].tags), (__loop: any) => {
                                                                let __forOutput = [];
                                                                for (let j = 0; j < App.Helper.count(catalog[i].tags); j++) {
                                                                    __loop.setCurrentTimes(j);
                                                                    __forOutput.push(
                                                                    this.html(`div-5-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1-for-1-${j}-span-1`, "span", parentElement,
                                                                        { classes: [{ type: 'static', value: "tag" }] },
                                                                        (parentElement: any) => [
                                                                        this.output(`div-5-ul-2-for-1-${i}-li-1-rc-if-1-case_1-div-1-for-1-${j}-span-1-output-1`, parentElement, true, ["catalog"], (parentElement: any) => catalog[i].tags[j])
                                                                        ])
                                                                    );
                                                                }
                                                                return __forOutput;
                                                            })
                                                        })
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
                        ])
                    );
                    n = 0;
                    __execArr.push(
                        this.html(`div-5-h3-3`, "h3", parentElement, {}, (parentElement: any) => [
                            this.text('While Loop Example')
                        ])
                    );
                    __execArr.push(
                        this.html(`div-5-ul-4`, "ul", parentElement, {}, (parentElement: any) => [
                            this.__while((loopCtx) => {
                                let __whileOutput = [];
                                while (n < MAX_COUNT) {
                                    loopCtx.setCurrentTimes(n);
                                    __whileOutput.push(
                                        this.html(`div-5-ul-4-while-1-${n}-li-1`, "li", parentElement, {}, (parentElement: any) => [
                                            this.text('Item #'),
                                            this.output(`div-5-ul-4-while-1-${n}-li-1-output-1`, parentElement, true, ["n"], (parentElement: any) => n + 1)
                                        ])
                                    );
                                        n++;
                                }
                                return __whileOutput;
                            })
                        ])
                    );
                    return __execArr;
                }),
            this.include("component-1", esamples/partial.sao, parentElement, [], (parentElement: any) => ({"data": products}))
            ]);
            }
        });

    }
}

// Export factory function
export function Input(__data__ = {}, systemData = {}): InputView {
    return new InputView(__data__, systemData);
}
export default Input;
