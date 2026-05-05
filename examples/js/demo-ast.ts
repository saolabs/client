import { View, ViewController, app, Application } from 'saola';

import {_} from 'saola';



const __VIEW_PATH__ = 'examples.demo-ast';
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



class DemoAstViewController extends ViewController {
    constructor(view: View) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this as any).setStaticConfig === 'function') {
            (this as any).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this as any).config = __VIEW_CONFIG__;
        }
    }
}

class DemoAstView extends View {
    constructor(__data__: any = {}, systemData: any = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, DemoAstViewController);
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
        let name = 'John Doe';
        __UPDATE_DATA_TRAIT__.name = (value: any) => name = value;
        const __VARIABLE_LIST__: any = ["name"];


        this.__ctrl__.setUserDefinedConfig({
            name: 'DemoAst',

                doAction(action: string) {
                    if (action === 'login') {
                        alert('Login action triggered!');
                    } else if (action === 'fetchPosts') {
                        alert('Fetch Posts action triggered!');
                    }
                },

                mounting() {
                    console.log('DemoAst component mounted');
                },

                mounted() {
                    console.log('DemoAst component fully mounted');
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
                // Then update states from data

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
            return this.wrapper((parentElement: any) => {
            const __execArr = [];
                let a = 10; let b = 20; let c = a + b;
                __execArr.push(
                    this.html(`div-1`, "div", parentElement, {}, (parentElement: any) => [
                        this.html(`div-1-p-1`, "p", parentElement, {}, (parentElement: any) => [
                            this.text('Value of a: '),
                            this.output(`div-1-p-1-output-1`, parentElement, true, [], (parentElement: any) => a)
                        ]),
                        this.html(`div-1-p-2`, "p", parentElement, {}, (parentElement: any) => [
                            this.text('Value of b: '),
                            this.output(`div-1-p-2-output-1`, parentElement, true, [], (parentElement: any) => b)
                        ]),
                        this.html(`div-1-p-3`, "p", parentElement, {}, (parentElement: any) => [
                            this.text('Value of c (a + b): '),
                            this.output(`div-1-p-3-output-1`, parentElement, true, [], (parentElement: any) => c)
                        ])
                    ])
                );
                __execArr.push(
                    this.html(`div-2`, "div", parentElement, {},
                        (parentElement: any) => {
                            const __execArr = [];
                            let email = 'Jane Smith'; let age = 30;
                            __execArr.push(
                                this.html(`div-2-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                    this.text('Name: '),
                                    this.output(`div-2-p-1-output-1`, parentElement, true, [], (parentElement: any) => name)
                                ])
                            );
                            __execArr.push(
                                this.html(`div-2-p-2`, "p", parentElement, {}, (parentElement: any) => [
                                    this.text('Email: '),
                                    this.output(`div-2-p-2-output-1`, parentElement, true, [], (parentElement: any) => email)
                                ])
                            );
                            __execArr.push(
                                this.html(`div-2-p-3`, "p", parentElement, {}, (parentElement: any) => [
                                    this.text('Age: '),
                                    this.output(`div-2-p-3-output-1`, parentElement, true, [], (parentElement: any) => age)
                                ])
                            );
                            return __execArr;
                        })
                );
                __execArr.push(
                    this.html(`tasks-3`, "tasks", parentElement, {}, (parentElement: any) => [
                        this.html(`tasks-3-demo-1`, "demo", parentElement, { attrs: { ":users": { type: 'static', value: "users" } } })
                    ])
                );
                __execArr.push(
                    this.html(`tasks-4`, "tasks", parentElement, { attrs: { "title": { type: 'static', value: "'Custom Task List'" } } })
                );
                __execArr.push(
                    this.html(`projects-5`, "projects", parentElement,
                        { attrs: { ":projects": { type: 'static', value: "projects" } } },
                        (parentElement: any) => [
                        this.html(`projects-5-div-1`, "div", parentElement,
                            { classes: [{ type: 'static', value: "header" }] },
                            (parentElement: any) => [
                            this.html(`projects-5-div-1-h2-1`, "h2", parentElement, {}, (parentElement: any) => [
                                this.text('My Projects '),
                                this.reactive(`projects-5-div-1-h2-1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                    const reactiveContents = [];
                                    let t: any;
                                    if (!(t = App.Helper.count(projects))) {
                                        reactiveContents.push(
                                        this.text(' Rỗng ')
                                        );
                                    }
                                    else {
                                        reactiveContents.push(
                                        this.text(' ('),
                                        this.output(`projects-5-div-1-h2-1-rc-if-1-case_2-output-1`, parentElement, true, [], (parentElement: any) => t),
                                        this.text(') ')
                                        );
                                    }
                                    return reactiveContents;
                                })
                            ])
                            ]),
                        this.html(`projects-5-div-2`, "div", parentElement,
                            { classes: [{ type: 'static', value: "footer" }] },
                            (parentElement: any) => [
                            this.html(`projects-5-div-2-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                this.text('Total Projects: '),
                                this.output(`projects-5-div-2-p-1-output-1`, parentElement, true, [], (parentElement: any) => App.Helper.count(projects))
                            ])
                            ]),
                        this.html(`projects-5-tasks-3`, "tasks", parentElement,
                            { attrs: { ":owners": { type: 'static', value: "['Alice', 'Bob']" } } },
                            (parentElement: any) => [
                            this.html(`projects-5-tasks-3-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "header" }] },
                                (parentElement: any) => {
                                    const __execArr = [];
                                    __execArr.push(
                                        this.html(`projects-5-tasks-3-div-1-h3-1`, "h3", parentElement, {}, (parentElement: any) => [
                                            this.text('Task Owners')
                                        ])
                                    );
                                    __execArr.push(
                                        this.html(`projects-5-tasks-3-div-1-p-2`, "p", parentElement, {}, (parentElement: any) => [
                                            this.output(`projects-5-tasks-3-div-1-p-2-output-1`, parentElement, true, [], (parentElement: any) => content)
                                        ])
                                    );
                                    let test = 'Hello World';
                                    __execArr.push(
                                        this.__foreach(posts, (post: any, __loopKey: any, __loopIndex: any, __loop: any) => {
                                            const __execArr = [];
                                            __execArr.push(
                                                this.html(`projects-5-tasks-3-div-1-foreach-1-${__loopIndex}-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                                    this.output(`projects-5-tasks-3-div-1-foreach-1-${__loopIndex}-p-1-output-1`, parentElement, true, [], (parentElement: any) => content)
                                                ])
                                            );
                                            let content = 'This is a test';
                                            __execArr.push(
                                                this.html(`projects-5-tasks-3-div-1-foreach-1-${__loopIndex}-p-2`, "p", parentElement, {}, (parentElement: any) => [
                                                    this.output(`projects-5-tasks-3-div-1-foreach-1-${__loopIndex}-p-2-output-1`, parentElement, true, [], (parentElement: any) => post.title),
                                                    this.text(': '),
                                                    this.output(`projects-5-tasks-3-div-1-foreach-1-${__loopIndex}-p-2-output-2`, parentElement, true, [], (parentElement: any) => post.content),
                                                    this.text(' '),
                                                    this.output(`projects-5-tasks-3-div-1-foreach-1-${__loopIndex}-p-2-output-3`, parentElement, true, [], (parentElement: any) => content)
                                                ])
                                            );
                                            return __execArr;
                                        })
                                    );
                                    return __execArr;
                                }),
                            this.html(`projects-5-tasks-3-p-2`, "p", parentElement, {}, (parentElement: any) => [
                                this.output(`projects-5-tasks-3-p-2-output-1`, parentElement, true, [], (parentElement: any) => content)
                            ]),
                            this.html(`projects-5-tasks-3-demo-3`, "demo", parentElement, { attrs: { ":users": { type: 'static', value: "users" } } }),
                            this.reactive(`projects-5-tasks-3-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                const reactiveContents = [];
                                let person: any;
                                if (!(person = App.Helper.getPerson())) {
                                    reactiveContents.push(
                                    this.html(`projects-5-tasks-3-rc-if-1-case_1-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                        this.text('No person found.')
                                    ])
                                    );
                                }
                                else {
                                    reactiveContents.push(
                                    this.html(`projects-5-tasks-3-rc-if-1-case_2-p-1`, "p", parentElement, {}, (parentElement: any) => [
                                        this.text('Person found: '),
                                        this.output(`projects-5-tasks-3-rc-if-1-case_2-p-1-output-1`, parentElement, true, [], (parentElement: any) => person.name)
                                    ])
                                    );
                                }
                                return reactiveContents;
                            })
                            ])
                        ])
                );
                __execArr.push(
                    this.html(`counter-6`, "counter", parentElement, {})
                );
                __execArr.push(
                    this.html(`demo-7`, "demo", parentElement, {})
                );
                __execArr.push(
                    this.html(`alert-8`, "alert", parentElement, { attrs: { "type": { type: 'static', value: "success" }, "message": { type: 'static', value: "This is a custom alert component!" } } })
                );
            return __execArr;
            });
            }
        });

    }
}

// Export factory function
export function DemoAst(__data__ = {}, systemData = {}): DemoAstView {
    return new DemoAstView(__data__, systemData);
}
export default DemoAst;
