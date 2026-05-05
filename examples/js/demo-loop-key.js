import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.demo-loop-key';
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



class DemoLoopKeyViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class DemoLoopKeyView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, DemoLoopKeyViewController);
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
        let {posts = [], categories = [], postCategories = [], postTags = [], postAuthors = []} = __data__;
        const set$postList = __STATE__.__.register('postList');
        let postList = null;
        const setPostList = (state) => {
            postList = state;
            set$postList(state);
        };
        __STATE__.__.setters.setPostList = setPostList;
        __STATE__.__.setters.postList = setPostList;
        const update$postList = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('postList', value);
                postList = value;
            }
        };
        const set$categoryList = __STATE__.__.register('categoryList');
        let categoryList = null;
        const setCategoryList = (state) => {
            categoryList = state;
            set$categoryList(state);
        };
        __STATE__.__.setters.setCategoryList = setCategoryList;
        __STATE__.__.setters.categoryList = setCategoryList;
        const update$categoryList = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('categoryList', value);
                categoryList = value;
            }
        };
        let i = 0;
        __UPDATE_DATA_TRAIT__.posts = value => posts = value;
        __UPDATE_DATA_TRAIT__.categories = value => categories = value;
        __UPDATE_DATA_TRAIT__.postCategories = value => postCategories = value;
        __UPDATE_DATA_TRAIT__.postTags = value => postTags = value;
        __UPDATE_DATA_TRAIT__.postAuthors = value => postAuthors = value;
        __UPDATE_DATA_TRAIT__.i = value => i = value;
        const __VARIABLE_LIST__ = ["posts", "categories", "postCategories", "postTags", "postAuthors", "i"];


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
                update$postList(posts);
                update$categoryList(categories);
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
                update$postList(posts);
                update$categoryList(categories);
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
                { classes: [{ type: 'static', value: "flex" }, { type: 'static', value: "flex-col" }, { type: 'static', value: "gap-2" }] },
                (parentElement) => [
                this.__for("increment", 0, 10, (__loop) => {
                        let __forOutput = [];
                        for (let i = 0; i < 10; i++) {
                            __loop.setCurrentTimes(i);
                            __forOutput.push(
                            this.html(`div-1-for-1-${i}-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "flex" }, { type: 'static', value: "items-center" }, { type: 'static', value: "gap-2" }] },
                                (parentElement) => [
                                this.html(`div-1-for-1-${i}-div-1-h2-1`, "h2", parentElement,
                                    { classes: [{ type: 'static', value: "text-sm" }] },
                                    (parentElement) => [
                                    this.text('Title '),
                                    this.output(`div-1-for-1-${i}-div-1-h2-1-output-1`, parentElement, true, ["i"], (parentElement) => i)
                                    ]),
                                this.reactive(`div-1-for-1-${i}-div-1-foreach-1`, "foreach", parentReactive, parentElement, ["categoryList"], (parentReactive, parentElement) => {
                                    return this.__foreach(categoryList, (categoryItem, __loopKey, __loopIndex, __loop) => [
                                        this.html(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1`, "div", parentElement,
                                            { classes: [{ type: 'static', value: "category-item" }] },
                                            (parentElement) => [
                                            this.html(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-h3-1`, "h3", parentElement,
                                                { classes: [{ type: 'static', value: "category-name" }] },
                                                (parentElement) => [
                                                this.output(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-h3-1-output-1`, parentElement, true, [], (parentElement) => categoryItem.name)
                                                ]),
                                            this.html(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-div-2`, "div", parentElement,
                                                { classes: [{ type: 'static', value: "post-list" }] },
                                                (parentElement) => [
                                                this.__foreach(categoryItem.posts, (postItem, __loopKey, __loopIndex, __loop) => [
                                                        this.html(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-div-2-foreach-1-${postItem.id}-div-1`, "div", parentElement,
                                                            { classes: [{ type: 'static', value: "post-item" }] },
                                                            (parentElement) => [
                                                            this.html(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-div-2-foreach-1-${postItem.id}-div-1-h4-1`, "h4", parentElement,
                                                                { classes: [{ type: 'static', value: "post-title" }] },
                                                                (parentElement) => [
                                                                this.output(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-div-2-foreach-1-${postItem.id}-div-1-h4-1-output-1`, parentElement, true, [], (parentElement) => postItem.title)
                                                                ]),
                                                            this.html(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-div-2-foreach-1-${postItem.id}-div-1-p-2`, "p", parentElement,
                                                                { classes: [{ type: 'static', value: "post-content" }] },
                                                                (parentElement) => [
                                                                this.output(`div-1-for-1-${i}-div-1-foreach-1-${categoryItem.id}-div-1-div-2-foreach-1-${postItem.id}-div-1-p-2-output-1`, parentElement, true, [], (parentElement) => postItem.content)
                                                                ])
                                                            ])
                                                ])
                                                ])
                                            ])
                                    ])
                                })
                                ])
                            );
                        }
                        return __forOutput;
                    })
                ])
            ]);
            }
        });

    }
}

// Export factory function
export function DemoLoopKey(__data__ = {}, systemData = {}) {
    return new DemoLoopKeyView(__data__, systemData);
}
export default DemoLoopKey;
