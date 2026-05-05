import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.demo2';
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



class Demo2ViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class Demo2View extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, Demo2ViewController);
        const App = app("App");
        const __STATE__ = this.__ctrl__.states;
        const {__base__, __layout__, __page__, __component__, __template__, __context__, __partial__, __system__, __env = {}, __helper = {}} = systemData;
        const __VIEW_ID__ = __data__.__SSR_VIEW_ID__ || App.View.generateViewId();

        const useState = (value) => {
            return __STATE__.__useState(value);
        };
        const updateRealState = (state) => {
            __STATE__.__.updateRealState(state);
        };

        const lockUpdateRealState = () => {
            __STATE__.__.lockUpdateRealState();
        };
        const updateStateByKey = (key, state) => {
            __STATE__.__.updateStateByKey(key, state);
        };


        const __UPDATE_DATA_TRAIT__ = {};
        let {demoList = []} = __data__;
        const set$status = __STATE__.__.register('status');
        let status = null;
        const setStatus = (state) => {
            status = state;
            set$status(state);
        };
        __STATE__.__.setters.setStatus = setStatus;
        __STATE__.__.setters.status = setStatus;
        const update$status = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('status', value);
                status = value;
            }
        };
        const set$user = __STATE__.__.register('user');
        let user = null;
        const setUser = (state) => {
            user = state;
            set$user(state);
        };
        __STATE__.__.setters.setUser = setUser;
        __STATE__.__.setters.user = setUser;
        const update$user = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('user', value);
                user = value;
            }
        };
        const set$posts = __STATE__.__.register('posts');
        let posts = null;
        const setPosts = (state) => {
            posts = state;
            set$posts(state);
        };
        __STATE__.__.setters.setPosts = setPosts;
        __STATE__.__.setters.posts = setPosts;
        const update$posts = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('posts', value);
                posts = value;
            }
        };
        let i = 0;
        __UPDATE_DATA_TRAIT__.demoList = value => demoList = value;
        __UPDATE_DATA_TRAIT__.i = value => i = value;
        const __VARIABLE_LIST__ = ["demoList", "i"];


        this.__ctrl__.setUserDefinedConfig({

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
            commitConstructorData: function() {
                // Then update states from data
                update$status(false);
                update$user({"name": "Jone", "email": "jon@test.com"});
                update$posts([{"title": "...", "content": "..."}, {"title": "...", "content": "..."}, {"title": "...", "content": "..."}, {"title": "...", "content": "..."}]);
                // Finally lock state updates
                lockUpdateRealState();
            },
            updateVariableData: function(data) {
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
                update$status(false);
                update$user({"name": "Jone", "email": "jon@test.com"});
                update$posts([{"title": "...", "content": "..."}, {"title": "...", "content": "..."}, {"title": "...", "content": "..."}, {"title": "...", "content": "..."}]);
                // Finally lock state updates
                lockUpdateRealState();
            },
            updateVariableItemData: function(key, value) {
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
            return this.wrapper((parentElement) => [
            this.html(`div-1`, "div", parentElement,
                { classes: [{ type: 'static', value: "demo" }, { type: 'binding', value: "active", factory: () => status, stateKeys: ["status"] }], attrs: { "dataCount": { type: 'binding', value: App.Helper.count(demoList), factory: () => App.Helper.count(demoList), stateKeys: [] }, "dataUserName": { type: 'binding', value: user.name, factory: () => user.name, stateKeys: ["user"] } } },
                (parentElement) => [
                this.html(`div-1-h1-1`, "h1", parentElement, {}, (parentElement) => [
                    this.text('Hello, '),
                    this.output(`div-1-h1-1-output-1`, parentElement, true, ["user"], (parentElement) => user.name),
                    this.text('!')
                ]),
                this.html(`div-1-p-2`, "p", parentElement, {}, (parentElement) => [
                    this.text('Your email is '),
                    this.html(`div-1-p-2-span-1`, "span", parentElement, {}, (parentElement) => [
                        this.output(`div-1-p-2-span-1-output-1`, parentElement, true, ["user"], (parentElement) => user.email)
                    ]),
                    this.text('.')
                ]),
                this.html(`div-1-button-3`, "button", parentElement,
                    { events: { click: [(event) => setStatus(!status)] } },
                    (parentElement) => [
                    this.text('Toggle Status: '),
                    this.output(`div-1-button-3-output-1`, parentElement, true, ["status"], (parentElement) => status ? 'On' : 'Off')
                    ]),
                this.html(`div-1-h2-4`, "h2", parentElement, {}, (parentElement) => [
                    this.text('Posts:')
                ]),
                this.html(`div-1-ul-5`, "ul", parentElement, {}, (parentElement) => [
                    this.reactive(`div-1-ul-5-rc-if-1`, "if", parentReactive, parentElement, ["posts"], (parentReactive, parentElement) => {
                        const reactiveContents = [];
                        if (App.Helper.count(posts) === 0) {
                            reactiveContents.push(
                            this.html(`div-1-ul-5-rc-if-1-case_1-li-1`, "li", parentElement, {}, (parentElement) => [
                                this.text('No posts available.')
                            ])
                            );
                        }
                        else {
                            reactiveContents.push(
                            this.reactive(`div-1-ul-5-rc-if-1-case_2-foreach-1`, "foreach", parentReactive, parentElement, ["posts"], (parentReactive, parentElement) => {
                                return this.__foreach(posts, (post, __loopKey, __loopIndex, __loop) => [
                                    this.html(`div-1-ul-5-rc-if-1-case_2-foreach-1-${__loopIndex}-li-1`, "li", parentElement, {}, (parentElement) => [
                                        this.html(`div-1-ul-5-rc-if-1-case_2-foreach-1-${__loopIndex}-li-1-h3-1`, "h3", parentElement, {}, (parentElement) => [
                                            this.output(`div-1-ul-5-rc-if-1-case_2-foreach-1-${__loopIndex}-li-1-h3-1-output-1`, parentElement, true, [], (parentElement) => post.title)
                                        ]),
                                        this.html(`div-1-ul-5-rc-if-1-case_2-foreach-1-${__loopIndex}-li-1-p-2`, "p", parentElement, {}, (parentElement) => [
                                            this.output(`div-1-ul-5-rc-if-1-case_2-foreach-1-${__loopIndex}-li-1-p-2-output-1`, parentElement, true, [], (parentElement) => post.content)
                                        ])
                                    ])
                                ])
                            })
                            );
                        }
                        return reactiveContents;
                    })
                ]),
                this.html(`div-1-div-6`, "div", parentElement,
                    { classes: [{ type: 'static', value: "while-loop-demo" }] },
                    (parentElement) => [
                    this.__while((loopCtx) => {
                            loopCtx.setCount(5);
                        let __whileOutput = [];
                        while (i < 5) {
                            loopCtx.setCurrentTimes(i);
                            __whileOutput.push(
                                this.html(`div-1-div-6-while-1-${i}-p-1`, "p", parentElement, {}, (parentElement) => [
                                    this.text('Counter: '),
                                    this.output(`div-1-div-6-while-1-${i}-p-1-output-1`, parentElement, true, ["i"], (parentElement) => i)
                                ])
                            );
                                i++;
                        }
                        return __whileOutput;
                    }, 5)
                    ])
                ])
            ]);
            }
        });

    }
}

// Export factory function
export function Demo2(__data__ = {}, systemData = {}) {
    return new Demo2View(__data__, systemData);
}
export default Demo2;
