import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.await';
const __VIEW_NAMESPACE__ = 'examples.';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: true,
    viewType: 'view',
    sections: {
        "content":{
            "type":"long",
            "preloader":true,
            "useVars":true,
            "script":{}
        },
        "footer":{
            "type":"long",
            "preloader":false,
            "useVars":false,
            "script":{}
        },
        "sidebar":{
            "type":"short",
            "preloader":false,
            "useVars":false,
            "script":{}
        }
    },
    wrapperConfig: { enable: false, tag: null, subscribe: true, attributes: {} },
    hasAwaitData: true,
    hasFetchData: false,
    usesVars: true,
    hasSections: true,
    hasSectionPreload: true,
    hasPrerender: true,
    renderLongSections: ["content"],
    renderSections: [],
    prerenderSections: ["content","footer","sidebar"]
};



class AwaitViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class AwaitView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, AwaitViewController);
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
        let {user = null, counter = 0} = __data__;
        __UPDATE_DATA_TRAIT__.user = value => user = value;
        __UPDATE_DATA_TRAIT__.counter = value => counter = value;
        const __VARIABLE_LIST__ = ["user", "counter"];


        this.__ctrl__.setUserDefinedConfig({

        });

        this.__ctrl__.setup({
            superView: 'layout',
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

                // Finally lock state updates

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

                // Finally lock state updates

            },
            updateVariableItemData: function(key, value) {
                this.data[key] = value;
                if (typeof __UPDATE_DATA_TRAIT__[key] === "function") {
                    __UPDATE_DATA_TRAIT__[key](value);
                }
            },
            prerender: function() {
                let parentElement = this.parentElement;
                let parentReactive = null;
                this.block('block-content', 'content', (parentElement) => [this.html("pr-div-1", "div", parentElement, { classes: [{ type: 'static', value: 'data-preloader' }], attributes: [{ name: 'ref', value: __VIEW_ID__ }, { name: 'data-view-name', value: __VIEW_PATH__ }] }, (parentElement) => [this.text('loading')])]);
                this.block('block-footer', 'footer', (parentElement) => [this.html(`block-footer-footer-1`, "footer", parentElement, {}, (parentElement) => [this.text('Copyright 2026')])]);
                this.section('sidebar', { type: 'static', contentType: 'text', stateKeys: [] }, () => 'posts');
                return this.extendView('layout', {});
                },
            render: function () {
            let parentElement = this.parentElement;
            let parentReactive = null;
            this.block('block-content', 'content', (parentElement) => [
            this.html(`block-content-div-1`, "div", parentElement, {}, (parentElement) => [
                this.reactive(`block-content-div-1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive, parentElement) => {
                    const reactiveContents = [];
                    if (user) {
                        reactiveContents.push(
                        this.html(`block-content-div-1-rc-if-1-case_1-h1-1`, "h1", parentElement, {}, (parentElement) => [
                            this.text('Welcome '),
                            this.output(`block-content-div-1-rc-if-1-case_1-h1-1-output-1`, parentElement, true, [], (parentElement) => user.name)
                        ])
                        );
                    }
                    else {
                        reactiveContents.push(
                        this.html(`block-content-div-1-rc-if-1-case_2-p-1`, "p", parentElement, {}, (parentElement) => [
                            this.text('Please login first')
                        ])
                        );
                    }
                    return reactiveContents;
                })
            ]),
            this.html(`block-content-div-2`, "div", parentElement, {}, (parentElement) => [
                this.html(`block-content-div-2-button-1`, "button", parentElement,
                    { events: { click: [{"handler":"doAction","params":["login"]}] } },
                    (parentElement) => [
                    this.text('Login')
                    ]),
                this.html(`block-content-div-2-button-2`, "button", parentElement,
                    { events: { click: [{"handler":"doAction","params":["incrementCounter"]}] } },
                    (parentElement) => [
                    this.text('Increment Counter')
                    ]),
                this.html(`block-content-div-2-p-3`, "p", parentElement, {}, (parentElement) => [
                    this.text('Counter: '),
                    this.output(`block-content-div-2-p-3-output-1`, parentElement, true, [], (parentElement) => counter)
                ])
            ])
            ]);
            this.superViewPath = __layout__ + 'layout';
            return this.extendView(this.superViewPath, {});
            }
        });

    }
}

// Export factory function
export function Await(__data__ = {}, systemData = {}) {
    return new AwaitView(__data__, systemData);
}
export default Await;
