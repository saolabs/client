import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.test-yield-layout';
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



class TestYieldLayoutViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class TestYieldLayoutView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, TestYieldLayoutViewController);
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
        const __VARIABLE_LIST__ = [];


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
            return null;
            },
            render: function () {
            let parentElement = this.parentElement;
            let parentReactive = null;
            return this.wrapper((parentElement) => [
            this.html(`div-1`, "div", parentElement,
                { classes: [{ type: 'static', value: "app-layout" }] },
                (parentElement) => [
                this.html(`div-1-header-1`, "header", parentElement, {}, (parentElement) => [
                    this.html(`div-1-header-1-h1-1`, "h1", parentElement, {}, (parentElement) => [
                        this.text('@yield(\'title\', \'Default Title\')')
                    ]),
                    this.html(`div-1-header-1-nav-2`, "nav", parentElement, {}, (parentElement) => [
                        this.text('@yield(\'nav\')')
                    ])
                ]),
                this.html(`div-1-main-2`, "main", parentElement, {}, (parentElement) => [
                    this.yield("div-1-main-2-yield-1", "content", null, parentElement)
                ]),
                this.html(`div-1-footer-3`, "footer", parentElement, {}, (parentElement) => [
                    this.yield("div-1-footer-3-yield-1", "footer", '<p>Default Footer</p>', parentElement)
                ])
                ])
            ]);
            }
        });

    }
}

// Export factory function
export function TestYieldLayout(__data__ = {}, systemData = {}) {
    return new TestYieldLayoutView(__data__, systemData);
}
export default TestYieldLayout;
