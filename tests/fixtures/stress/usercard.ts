import { View, ViewController, app, Application } from '@saolabs/client';


const __VIEW_PATH__ = 'web.modules.stress.usercard';
const __VIEW_NAMESPACE__ = 'web.modules.stress.';
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



/**
 * Props của view — sinh tự động từ @props/@vars, không sửa tay.
 * Optional hết vì khai báo nào cũng có default.
 */
export interface StressUserCardProps {
    user?: Record<string, any>;
    highlight?: boolean;
    /** viewId server gán khi hydrate */
    __SSR_VIEW_ID__?: string;
    [key: string]: any;
}

class StressUserCardViewController extends ViewController {
    constructor(view: View) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this as any).setStaticConfig === 'function') {
            (this as any).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this as any).config = __VIEW_CONFIG__;
        }
    }
}

class StressUserCardView extends View {
    constructor(__data__: StressUserCardProps = {}, systemData: any = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, StressUserCardViewController);
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
        let {user = {}, highlight = false} = __data__;
        __STATE__.__.register('user', user);
        __STATE__.__.register('highlight', highlight);
        __UPDATE_DATA_TRAIT__.user = (value: any) => { user = value; updateStateByKey('user', value); };
        __UPDATE_DATA_TRAIT__.highlight = (value: any) => { highlight = value; updateStateByKey('highlight', value); };
        const __VARIABLE_LIST__: any = ["user", "highlight"];


        this.__ctrl__.setUserDefinedConfig({
            name: 'StressUserCard'
        });

        this.__ctrl__.setup({
            superView: null,
            subscribe: true,
            fetch: null,
            data: __data__,
            viewId: __VIEW_ID__,
            path: __VIEW_PATH__,
            scripts: [],
            styles: [{"type":"code","scoped":true,"content":".ucard { display: grid; grid-template-columns: 56px 1fr auto; gap: 12px; align-items: center; padding: 10px 12px; }\n    .ucard__id { font: 700 13px/1 Courier, monospace; opacity: .55; }\n    .ucard__main { display: grid; }\n    .ucard__main small { opacity: .6; }\n    .ucard__rev { font: 12px/1 Courier, monospace; opacity: .5; }\n    .ucard--hl { outline: 2px solid var(--cobalt, #2b50ff); }"}],
            resources: [],
            commitConstructorData: function(this: any) {
                // Then update states from data

                // Finally lock state updates

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
                // Re-derive CHỈ state phụ thuộc data — state literal của instance KHÔNG reset

                // Finally lock state updates

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
            this.html(`d69e6b1d`, "div", parentElement,
                { classes: [{ type: 'static', value: "ucard" }, { type: 'binding', value: "ucard--hl", factory: () => highlight, stateKeys: ["highlight"] }] },
                (parentElement: any) => [
                this.html(`6add9c13`, "div", parentElement,
                    { classes: [{ type: 'static', value: "ucard__id" }] },
                    (parentElement: any) => [
                    this.text('#'),
                    this.output(`ca637d8a`, parentElement, true, ["user"], (parentElement: any) => user['id'])
                    ]),
                this.html(`fccc82c8`, "div", parentElement,
                    { classes: [{ type: 'static', value: "ucard__main" }] },
                    (parentElement: any) => [
                    this.html(`0820a58c`, "strong", parentElement, {}, (parentElement: any) => [
                        this.output(`a11e2b83`, parentElement, true, ["user"], (parentElement: any) => user['name'])
                    ]),
                    this.html(`8fe9dc9c`, "small", parentElement, {}, (parentElement: any) => [
                        this.output(`c3cd4b08`, parentElement, true, ["user"], (parentElement: any) => user['email'])
                    ])
                    ]),
                this.html(`6b7c3ec4`, "div", parentElement,
                    { classes: [{ type: 'static', value: "ucard__rev" }] },
                    (parentElement: any) => [
                    this.text('rev '),
                    this.output(`21020b82`, parentElement, true, ["user"], (parentElement: any) => user['rev'])
                    ])
                ])
            ]);
            }
        });

    }
}

// Export factory function
export function StressUserCard(__data__: StressUserCardProps = {}, systemData: any = {}): StressUserCardView {
    return new StressUserCardView(__data__, systemData);
}
export default StressUserCard;
