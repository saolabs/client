import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.home';
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



class HomeViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class HomeView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, HomeViewController);
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
            this.include("component-1", __template__+'sessions.tasks', parentElement, [], (parentElement) => ({
                    __ONE_CHILDREN_CONTENT__: (parentElement) => [
                    this.include("component-1-component-1", __template__+'demo.fetch', parentElement, [], (parentElement) => ({"users": users}))
                ]
                })),
            this.include("component-2", __template__+'sessions.tasks', parentElement, [], (parentElement) => ({"title": "Custom Task List"})),
            this.include("component-3", __template__+'sessions.projects', parentElement, [], (parentElement) => ({
                    "projects": projects,
                    __ONE_CHILDREN_CONTENT__: (parentElement) => [
                    this.html(`component-3-div-1`, "div", parentElement,
                        { classes: [{ type: 'static', value: "header" }] },
                        (parentElement) => [
                        this.html(`component-3-div-1-h2-1`, "h2", parentElement, {}, (parentElement) => [
                            this.text('My Projects')
                        ])
                        ]),
                    this.html(`component-3-div-2`, "div", parentElement,
                        { classes: [{ type: 'static', value: "footer" }] },
                        (parentElement) => [
                        this.html(`component-3-div-2-p-1`, "p", parentElement, {}, (parentElement) => [
                            this.text('Total Projects: '),
                            this.output(`component-3-div-2-p-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.count(projects))
                        ])
                        ]),
                    this.include("component-3-component-1", __template__+'sessions.tasks', parentElement, [], (parentElement) => ({
                            "owners": ["Alice", "Bob"],
                            __ONE_CHILDREN_CONTENT__: (parentElement) => [
                            this.html(`component-3-component-1-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "header" }] },
                                (parentElement) => [
                                this.html(`component-3-component-1-div-1-h3-1`, "h3", parentElement, {}, (parentElement) => [
                                    this.text('Task Owners')
                                ])
                                ]),
                            this.include("component-3-component-1-component-1", __template__+'demo.fetch', parentElement, [], (parentElement) => ({"users": users}))
                        ]
                        }))
                ]
                })),
            this.include("component-4", 'sessions.tasks.count', parentElement, [], (parentElement) => ({})),
            this.include("component-5", __template__+'demo.fetch', parentElement, [], (parentElement) => ({})),
            this.include("component-6", __blade_custom_path__, parentElement, [], (parentElement) => ({"type": "success", "message": "This is a custom alert component!"}))
            ]);
            }
        });

    }
}

// Export factory function
export function Home(__data__ = {}, systemData = {}) {
    return new HomeView(__data__, systemData);
}
export default Home;
