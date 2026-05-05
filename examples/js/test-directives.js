import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.test-directives';
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



class TestDirectivesViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class TestDirectivesView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, TestDirectivesViewController);
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
        const set$count = __STATE__.__.register('count');
        let count = null;
        const setCount = (state) => {
            count = state;
            set$count(state);
        };
        __STATE__.__.setters.setCount = setCount;
        __STATE__.__.setters.count = setCount;
        const update$count = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('count', value);
                count = value;
            }
        };
        let message = 'Hello';
        const MAX = 100;
        let {temp} = __data__;
        __UPDATE_DATA_TRAIT__.message = value => message = value;
        __UPDATE_DATA_TRAIT__.temp = value => temp = value;
        const __VARIABLE_LIST__ = ["message", "temp"];


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
                update$count(0);
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
                update$count(0);
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
                { classes: [{ type: 'static', value: "test-component" }] },
                (parentElement) => [
                this.html(`div-1-h3-1`, "h3", parentElement, {}, (parentElement) => [
                    this.text('State: '),
                    this.output(`div-1-h3-1-output-1`, parentElement, true, ["count"], (parentElement) => count)
                ]),
                this.html(`div-1-p-2`, "p", parentElement, {}, (parentElement) => [
                    this.text('Message: '),
                    this.output(`div-1-p-2-output-1`, parentElement, true, [], (parentElement) => message)
                ]),
                this.html(`div-1-p-3`, "p", parentElement, {}, (parentElement) => [
                    this.text('Max: '),
                    this.output(`div-1-p-3-output-1`, parentElement, true, [], (parentElement) => MAX)
                ]),
                this.reactive(`div-1-rc-if-1`, "if", parentReactive, parentElement, ["count"], (parentReactive, parentElement) => {
                    const reactiveContents = [];
                    if (count > 5) {
                        reactiveContents.push(
                        this.html(`div-1-rc-if-1-case_1-div-1`, "div", parentElement, {}, (parentElement) => [
                            this.text('Count is greater than 5')
                        ])
                        );
                    }
                    else {
                        reactiveContents.push(
                        this.html(`div-1-rc-if-1-case_2-div-1`, "div", parentElement, {}, (parentElement) => [
                            this.text('Count is 5 or less')
                        ])
                        );
                    }
                    return reactiveContents;
                }),
                this.__foreach([1, 2, 3], (item, __loopKey, __loopIndex, __loop) => [
                        this.html(`div-1-foreach-2-${__loopIndex}-div-1`, "div", parentElement, {}, (parentElement) => [
                            this.text('Item: '),
                            this.output(`div-1-foreach-2-${__loopIndex}-div-1-output-1`, parentElement, true, [], (parentElement) => item)
                        ])
                ]),
                this.html(`div-1-button-4`, "button", parentElement,
                    { events: { click: [(event) => setCount(count + 1)] } },
                    (parentElement) => [
                    this.text('Increment')
                    ])
                ])
            ]);
            }
        });

    }
}

// Export factory function
export function TestDirectives(__data__ = {}, systemData = {}) {
    return new TestDirectivesView(__data__, systemData);
}
export default TestDirectives;
