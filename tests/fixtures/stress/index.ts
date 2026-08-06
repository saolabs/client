import { View, ViewController, app, Application } from '@saolabs/client';


const __VIEW_PATH__ = 'web.modules.stress.index';
const __VIEW_NAMESPACE__ = 'web.modules.stress.';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: true,
    viewType: 'view',
    sections: {
        "workspace":{
            "type":"long",
            "preloader":false,
            "useVars":true,
            "script":{}
        }
    },
    wrapperConfig: { enable: false, tag: null, subscribe: true, attributes: {} },
    hasAwaitData: false,
    hasFetchData: false,
    usesVars: false,
    hasSections: true,
    hasSectionPreload: false,
    hasPrerender: false,
    renderLongSections: ["workspace"],
    renderSections: [],
    prerenderSections: []
};



/**
 * Props của view — sinh tự động từ @props/@vars, không sửa tay.
 * Optional hết vì khai báo nào cũng có default.
 */
export interface StressPageProps {
    /** viewId server gán khi hydrate */
    __SSR_VIEW_ID__?: string;
    [key: string]: any;
}

class StressPageViewController extends ViewController {
    constructor(view: View) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this as any).setStaticConfig === 'function') {
            (this as any).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this as any).config = __VIEW_CONFIG__;
        }
    }
}

class StressPageView extends View {
    constructor(__data__: StressPageProps = {}, systemData: any = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, StressPageViewController);
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
        const set$users = __STATE__.__.register('users');
        let users: any = [{ id: 1, name: 'Mai Lan',  email: 'lan@saola.dev',  rev: 1, active: true,  roles: [{ name: 'admin' }, { name: 'dev' }] }, { id: 2, name: 'Trần Bảo', email: 'bao@saola.dev',  rev: 1, active: false, roles: [{ name: 'viewer' }] }, { id: 3, name: 'Hồ Vy',    email: 'vy@saola.dev',   rev: 1, active: true,  roles: [] }];
        const setUsers = (state: any) => {
            users = state;
            set$users(state);
        };
        __STATE__.__.setters.setUsers = setUsers;
        __STATE__.__.setters.users = setUsers;
        const update$users = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('users', value);
                users = value;
            }
        };
        const set$tags = __STATE__.__.register('tags');
        let tags: any = ["hydration", "reactive", "loop", "cleanup"];
        const setTags = (state: any) => {
            tags = state;
            set$tags(state);
        };
        __STATE__.__.setters.setTags = setTags;
        __STATE__.__.setters.tags = setTags;
        const update$tags = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('tags', value);
                tags = value;
            }
        };
        const set$query = __STATE__.__.register('query');
        let query: any = '';
        const setQuery = (state: any) => {
            query = state;
            set$query(state);
        };
        __STATE__.__.setters.setQuery = setQuery;
        __STATE__.__.setters.query = setQuery;
        const update$query = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('query', value);
                query = value;
            }
        };
        const set$selectedId = __STATE__.__.register('selectedId');
        let selectedId: any = 0;
        const setSelectedId = (state: any) => {
            selectedId = state;
            set$selectedId(state);
        };
        __STATE__.__.setters.setSelectedId = setSelectedId;
        __STATE__.__.setters.selectedId = setSelectedId;
        const update$selectedId = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('selectedId', value);
                selectedId = value;
            }
        };
        const set$refreshCount = __STATE__.__.register('refreshCount');
        let refreshCount: any = 0;
        const setRefreshCount = (state: any) => {
            refreshCount = state;
            set$refreshCount(state);
        };
        __STATE__.__.setters.setRefreshCount = setRefreshCount;
        __STATE__.__.setters.refreshCount = setRefreshCount;
        const update$refreshCount = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('refreshCount', value);
                refreshCount = value;
            }
        };
        const set$modalOpen = __STATE__.__.register('modalOpen');
        let modalOpen: any = false;
        const setModalOpen = (state: any) => {
            modalOpen = state;
            set$modalOpen(state);
        };
        __STATE__.__.setters.setModalOpen = setModalOpen;
        __STATE__.__.setters.modalOpen = setModalOpen;
        const update$modalOpen = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('modalOpen', value);
                modalOpen = value;
            }
        };
        const set$banner = __STATE__.__.register('banner');
        let banner: any = '';
        const setBanner = (state: any) => {
            banner = state;
            set$banner(state);
        };
        __STATE__.__.setters.setBanner = setBanner;
        __STATE__.__.setters.banner = setBanner;
        const update$banner = (value: any) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('banner', value);
                banner = value;
            }
        };
        let activeCount;
        const get$activeCount = __STATE__.__.computed('activeCount', () => users.filter(u => u.active).length, ["users"]);
        activeCount = get$activeCount();
        __STATE__.__.subscribe(['activeCount'], () => { activeCount = get$activeCount(); });
        let totalRoles;
        const get$totalRoles = __STATE__.__.computed('totalRoles', () => users.reduce((n, u) => n + u.roles.length, 0), ["users"]);
        totalRoles = get$totalRoles();
        __STATE__.__.subscribe(['totalRoles'], () => { totalRoles = get$totalRoles(); });
        const __VARIABLE_LIST__: any = [];


        this.__ctrl__.setUserDefinedConfig({
            name: 'StressPage',

                /**
                 * Mô phỏng ĐÚNG một lần refetch: dữ liệu giống hệt về cấu trúc nhưng
                 * MỌI object là reference mới (như JSON.parse của response thật).
                 * Đây là đường từng làm view con của @include biến mất khỏi DOM.
                 */
                refreshFromServer() {
                    const next = JSON.parse(JSON.stringify(users)).map(u => ({ ...u, rev: u.rev + 1 }));
                    setUsers(next);
                    setRefreshCount(refreshCount + 1);
                },

                applyQuery() {
                    const q = query.trim().toLowerCase();
                    if (!q) return;
                    setUsers(users.filter(u => u.name.toLowerCase().includes(q)));
                },

                selectUser(id) {
                    setSelectedId(selectedId === id ? 0 : id);
                },

                removeUser(id) {
                    setUsers(users.filter(u => u.id !== id));
                },

                showBannerOnce() {
                    setBanner('Nút này đã dùng hết lượt (.once).');
                },

                openModal() { setModalOpen(true); },
                closeModal() { setModalOpen(false); }
        });

        this.__ctrl__.setup({
            superView: __layout__ + "workspace",
            subscribe: true,
            fetch: null,
            data: __data__,
            viewId: __VIEW_ID__,
            path: __VIEW_PATH__,
            scripts: [],
            styles: [{"type":"code","scoped":true,"content":".stress { display: grid; gap: 16px; }\n    .stress__bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }\n    .stress__bar input { flex: 1 1 220px; }\n    .stress__banner { padding: 8px 12px; background: rgba(43, 80, 255, .08); }\n    .stress__list { display: grid; gap: 8px; }\n    .stress__row { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;\n        border: 1px solid rgba(0, 0, 0, .12); padding: 6px; cursor: pointer; }\n    .stress__roles { display: flex; gap: 6px; flex-wrap: wrap; }\n    .stress__roles--empty { opacity: .45; font-size: 13px; }\n    .chip { padding: 2px 8px; border: 1px solid currentColor; font-size: 12px; }\n    .chip--tag { opacity: .7; }\n    .stress__del { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; }\n    .stress__tags { display: flex; gap: 6px; flex-wrap: wrap; }\n    .stress__foot { display: flex; justify-content: space-between; align-items: center; }\n\n    .stress__backdrop { position: fixed; inset: 0; display: grid; place-items: center;\n        background: rgba(0, 0, 0, .45); }\n    .stress__modal { background: #fff; padding: 24px; min-width: 280px; }\n\n    /* @transition('row') — enter/leave cho hàng danh sách */\n    .row-enter-active, .row-leave-active { transition: opacity .18s ease, transform .18s ease; }\n    .row-enter-from, .row-leave-to { opacity: 0; transform: translateY(-6px); }\n\n    /* @transition('fade') — modal */\n    .fade-enter-active, .fade-leave-active { transition: opacity .15s ease; }\n    .fade-enter-from, .fade-leave-to { opacity: 0; }"}],
            resources: [],
            commitConstructorData: function(this: any) {
                // Then update states from data
                update$users([{ id: 1, name: 'Mai Lan',  email: 'lan@saola.dev',  rev: 1, active: true,  roles: [{ name: 'admin' }, { name: 'dev' }] }, { id: 2, name: 'Trần Bảo', email: 'bao@saola.dev',  rev: 1, active: false, roles: [{ name: 'viewer' }] }, { id: 3, name: 'Hồ Vy',    email: 'vy@saola.dev',   rev: 1, active: true,  roles: [] }]);
                update$tags(["hydration", "reactive", "loop", "cleanup"]);
                update$query('');
                update$selectedId(0);
                update$refreshCount(0);
                update$modalOpen(false);
                update$banner('');
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
                // Re-derive CHỈ state phụ thuộc data — state literal của instance KHÔNG reset

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
            this.block('block-workspace', 'workspace', (parentElement: any) => [
            this.html(`33ba6fc5`, "header", parentElement,
                { classes: [{ type: 'static', value: "workspace-topbar" }] },
                (parentElement: any) => [
                this.html(`74083b07`, "div", parentElement, {}, (parentElement: any) => [
                    this.html(`6066db4b`, "p", parentElement,
                        { classes: [{ type: 'static', value: "eyebrow" }] },
                        (parentElement: any) => [
                        this.html(`6cf41081`, "span", parentElement, {}, (parentElement: any) => [
                            this.text('04')
                        ]),
                        this.text(' Stress harness')
                        ]),
                    this.html(`0ddacfc5`, "h1", parentElement, {}, (parentElement: any) => [
                        this.text('Reactive · Hydration · Loop · Cleanup')
                    ])
                ]),
                this.html(`8d6a301b`, "div", parentElement,
                    { classes: [{ type: 'static', value: "completion-ring" }] },
                    (parentElement: any) => [
                    this.html(`07fe4995`, "strong", parentElement, {}, (parentElement: any) => [
                        this.output(`54916756`, parentElement, true, ["activeCount"], (parentElement: any) => activeCount),
                        this.text('/'),
                        this.output(`29b9d7bb`, parentElement, true, ["users"], (parentElement: any) => users.length)
                    ]),
                    this.html(`55822db1`, "span", parentElement, {}, (parentElement: any) => [
                        this.text('active')
                    ])
                    ])
                ]),
            this.html(`2532706c`, "section", parentElement,
                { classes: [{ type: 'static', value: "stress" }] },
                (parentElement: any) => [
                this.html(`9a7a2c94`, "form", parentElement,
                    { classes: [{ type: 'static', value: "stress__bar" }], events: { submit: [{"handler":"applyQuery","params":[]}] }, eventModifiers: { submit: ["prevent"] } },
                    (parentElement: any) => [
                    this.html(`f9037cca`, "input", parentElement, { attrs: { "type": { type: 'static', value: "text" }, "placeholder": { type: 'static', value: "Lọc theo tên…" } }, bind: { key: 'query' } }),
                    this.html(`14a49981`, "button", parentElement,
                        { attrs: { "type": { type: 'static', value: "submit" } } },
                        (parentElement: any) => [
                        this.text('Lọc')
                        ]),
                    this.html(`c0852b38`, "button", parentElement,
                        { attrs: { "type": { type: 'static', value: "button" } }, events: { click: [{"handler":"refreshFromServer","params":[]}] } },
                        (parentElement: any) => [
                        this.text('Refresh từ server '),
                        this.html(`06cc3708`, "span", parentElement, {}, (parentElement: any) => [
                            this.text('('),
                            this.output(`a147163d`, parentElement, true, ["refreshCount"], (parentElement: any) => refreshCount),
                            this.text(')')
                        ])
                        ]),
                    this.html(`c58ff588`, "button", parentElement,
                        { attrs: { "type": { type: 'static', value: "button" } }, events: { click: [{"handler":"showBannerOnce","params":[]}] }, eventModifiers: { click: ["once"] } },
                        (parentElement: any) => [
                        this.text('Chỉ chạy 1 lần')
                        ])
                    ]),
                this.reactive(`51d5eb06`, "if", parentReactive, parentElement, ["banner"], (parentReactive: any, parentElement: any) => {
                    const reactiveContents = [];
                    if (banner !== '') {
                        reactiveContents.push(
                        this.html(`8392c73c`, "p", parentElement,
                            { classes: [{ type: 'static', value: "stress__banner" }] },
                            (parentElement: any) => [
                            this.output(`736b3ca4`, parentElement, true, ["banner"], (parentElement: any) => banner)
                            ])
                        );
                    }
                    return reactiveContents;
                }),
                this.html(`aa5f781d`, "div", parentElement,
                    { classes: [{ type: 'static', value: "stress__list" }] },
                    (parentElement: any) => [
                    this.reactive(`15e184f6`, "foreach", parentReactive, parentElement, ["users"], (parentReactive: any, parentElement: any) => {
                        return this.__foreach(users, (user: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                            this.html(`c32f6f5f-${user['id']}`, "article", parentElement,
                                { classes: [{ type: 'static', value: "stress__row" }], events: { click: [{"handler":"selectUser","params":[user['id']]}] }, transition: { name: 'row' } },
                                (parentElement: any) => [
                                this.include(`b74c6015-${user['id']}`, 'web.modules.stress.usercard', parentElement, ["selectedId"], (parentElement: any) => ({"user": user, "highlight": selectedId === user['id']})),
                                this.reactive(`8d968fa6-${user['id']}`, "if", parentReactive, parentElement, [], (parentReactive: any, parentElement: any) => {
                                    const reactiveContents = [];
                                    if (user['roles'].length > 0) {
                                        reactiveContents.push(
                                        this.html(`e9f93fe3-${user['id']}`, "div", parentElement,
                                            { classes: [{ type: 'static', value: "stress__roles" }] },
                                            (parentElement: any) => [
                                            ...this.__foreach(user['roles'], (role: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                                                    this.html(`673116ff-${user['id']}-${__loopIndex}`, "span", parentElement,
                                                        { classes: [{ type: 'static', value: "chip" }] },
                                                        (parentElement: any) => [
                                                        this.output(`9c9f7633-${user['id']}-${__loopIndex}`, parentElement, true, [], (parentElement: any) => role['name'])
                                                        ])
                                            ])
                                            ])
                                        );
                                    }
                                    else {
                                        reactiveContents.push(
                                        this.html(`0e517e1d-${user['id']}`, "div", parentElement,
                                            { classes: [{ type: 'static', value: "stress__roles" }, { type: 'static', value: "stress__roles--empty" }] },
                                            (parentElement: any) => [
                                            this.text('chưa có vai trò')
                                            ])
                                        );
                                    }
                                    return reactiveContents;
                                }),
                                this.html(`d5531dfa-${user['id']}`, "button", parentElement,
                                    { classes: [{ type: 'static', value: "stress__del" }], events: { click: [{"handler":"removeUser","params":[user['id']]}] }, eventModifiers: { click: ["stop"] } },
                                    (parentElement: any) => [
                                    this.text('×')
                                    ])
                                ])
                        ], (user: any) => user['id'])
                    })
                    ]),
                this.html(`a734d4f3`, "div", parentElement,
                    { classes: [{ type: 'static', value: "stress__tags" }] },
                    (parentElement: any) => [
                    this.reactive(`a01b0e23`, "foreach", parentReactive, parentElement, ["tags"], (parentReactive: any, parentElement: any) => {
                        return this.__foreach(tags, (tag: any, __loopKey: any, __loopIndex: any, __loop: any) => [
                            this.html(`f57689da-${__loopIndex}`, "span", parentElement,
                                { classes: [{ type: 'static', value: "chip" }, { type: 'static', value: "chip--tag" }] },
                                (parentElement: any) => [
                                this.output(`0fa7832f-${__loopIndex}`, parentElement, true, [], (parentElement: any) => tag)
                                ])
                        ])
                    })
                    ]),
                this.html(`f34c97bb`, "footer", parentElement,
                    { classes: [{ type: 'static', value: "stress__foot" }] },
                    (parentElement: any) => [
                    this.html(`3c60daf7`, "span", parentElement, {}, (parentElement: any) => [
                        this.output(`a00ca178`, parentElement, true, ["totalRoles"], (parentElement: any) => totalRoles),
                        this.text(' vai trò')
                    ]),
                    this.html(`2ff70b01`, "button", parentElement,
                        { attrs: { "type": { type: 'static', value: "button" } }, events: { click: [{"handler":"openModal","params":[]}] } },
                        (parentElement: any) => [
                        this.text('Mở modal')
                        ])
                    ])
                ]),
            this.reactive(`db01f7b0`, "if", parentReactive, parentElement, ["modalOpen"], (parentReactive: any, parentElement: any) => {
                const reactiveContents = [];
                if (modalOpen) {
                    reactiveContents.push(
                    this.html(`ad12d7d5`, "div", parentElement,
                        { classes: [{ type: 'static', value: "stress__backdrop" }], events: { click: [{"handler":"closeModal","params":[]}] }, eventModifiers: { click: ["self"] }, transition: { name: 'fade' } },
                        (parentElement: any) => [
                        this.html(`642d2222`, "div", parentElement,
                            { classes: [{ type: 'static', value: "stress__modal" }] },
                            (parentElement: any) => [
                            this.html(`794917d8`, "h2", parentElement, {}, (parentElement: any) => [
                                this.text('Modal')
                            ]),
                            this.html(`7c01517b`, "p", parentElement, {}, (parentElement: any) => [
                                this.text('Bấm ra nền để đóng. Bấm trong hộp thì không.')
                            ]),
                            this.html(`d97a0d93`, "button", parentElement,
                                { attrs: { "type": { type: 'static', value: "button" } }, events: { click: [{"handler":"closeModal","params":[]}] } },
                                (parentElement: any) => [
                                this.text('Đóng')
                                ])
                            ])
                        ])
                    );
                }
                return reactiveContents;
            })
            ]);
            this.superViewPath = __layout__ + "workspace";
            return this.extendView(this.superViewPath, {});
            }
        });

    }
}

// Export factory function
export function StressPage(__data__: StressPageProps = {}, systemData: any = {}): StressPageView {
    return new StressPageView(__data__, systemData);
}
export default StressPage;
