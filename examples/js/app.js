import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.app';
const __VIEW_NAMESPACE__ = 'examples.';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: true,
    viewType: 'view',
    sections: {
        "meta:type":{
            "type":"short",
            "preloader":false,
            "useVars":false,
            "script":{}
        },
        "meta:og:image":{
            "type":"short",
            "preloader":false,
            "useVars":false,
            "script":{}
        },
        "footer":{
            "type":"long",
            "preloader":false,
            "useVars":false,
            "script":{}
        },
        "content":{
            "type":"long",
            "preloader":false,
            "useVars":true,
            "script":{}
        }
    },
    wrapperConfig: { enable: false, tag: null, subscribe: true, attributes: {} },
    hasAwaitData: false,
    hasFetchData: false,
    usesVars: true,
    hasSections: true,
    hasSectionPreload: false,
    hasPrerender: false,
    renderLongSections: ["footer","content"],
    renderSections: [],
    prerenderSections: []
};



class AppViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class AppView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, AppViewController);
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
        let {title = 'test', description = 'Mô tả', user = App.Helper.request().user()} = __data__;
        let test = 'demo';
        const set$userState = __STATE__.__.register('userState');
        let userState = null;
        const setUserState = (state) => {
            userState = state;
            set$userState(state);
        };
        __STATE__.__.setters.setUserState = setUserState;
        __STATE__.__.setters.userState = setUserState;
        const update$userState = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('userState', value);
                userState = value;
            }
        };
        const set$counter = __STATE__.__.register('counter');
        let counter = null;
        const setCounter = (state) => {
            counter = state;
            set$counter(state);
        };
        __STATE__.__.setters.setCounter = setCounter;
        __STATE__.__.setters.counter = setCounter;
        const update$counter = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('counter', value);
                counter = value;
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
        const set$userAvatar = __STATE__.__.register('userAvatar');
        let userAvatar = null;
        const setAvatar = (state) => {
            userAvatar = state;
            set$userAvatar(state);
        };
        __STATE__.__.setters.setAvatar = setAvatar;
        __STATE__.__.setters.userAvatar = setAvatar;
        const update$userAvatar = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('userAvatar', value);
                userAvatar = value;
            }
        };
        __UPDATE_DATA_TRAIT__.title = value => title = value;
        __UPDATE_DATA_TRAIT__.description = value => description = value;
        __UPDATE_DATA_TRAIT__.user = value => user = value;
        __UPDATE_DATA_TRAIT__.test = value => test = value;
        const __VARIABLE_LIST__ = ["title", "description", "user", "test"];


        this.__ctrl__.setUserDefinedConfig({
            signout() {
                    // Xử lý đăng xuất
                    console.log('User signed out');
                },
                changeAvatar(event) {
                    event.preventDefault();
                    // Xử lý thay đổi avatar
                    const newAvatar = prompt('Enter new avatar URL:');
                    if (newAvatar) {
                        setAvatar(newAvatar);
                        console.log('Avatar updated:', newAvatar);
                    }
                }
        });

        this.__ctrl__.setup({
            superView: `${__template__+'main'}`,
            subscribe: true,
            fetch: null,
            data: __data__,
            viewId: __VIEW_ID__,
            path: __VIEW_PATH__,
            scripts: [],
            styles: [{"type":"code","content":".site-logo {\n        width: 120px;\n        height: auto;\n    }\n    .site-logo.has-login {\n        width: 100px;\n    }\n    .account-image.user-avatar {\n        width: 40px;\n        height: 40px;\n        border-radius: 50%;\n    }\n    .account-menu {\n        display: none;\n        position: absolute;\n        background: white;\n        list-style: none;\n        padding: 10px;\n        border: 1px solid #ccc;\n    }\n    .btn-show-menu:hover + .account-menu {\n        display: block;\n    }"}],
            resources: [],
            commitConstructorData: function() {
                // Then update states from data
                update$userState(user);
                update$counter(0);
                update$posts([{"title": "title 1", "description": "Mô tả 1"}, {"title": "title 2", "description": "Mô tả 2"}, {"title": "title 3", "description": "Mô tả 3"}]);
                update$userAvatar(App.Helper.getUserAvatar(user));
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
                update$userState(user);
                update$counter(0);
                update$posts([{"title": "title 1", "description": "Mô tả 1"}, {"title": "title 2", "description": "Mô tả 2"}, {"title": "title 3", "description": "Mô tả 3"}]);
                update$userAvatar(App.Helper.getUserAvatar(user));
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
            this.section('meta:type', { type: 'static', contentType: 'text', stateKeys: [] }, () => 'article');
            this.section('meta:og:image', { type: 'static', contentType: 'text', stateKeys: [] }, () => 'https://vcc.vn/static/images/thumbnai.jpg');
            this.block('block-footer', 'footer', (parentElement) => [
            this.html(`block-footer-div-1`, "div", parentElement,
                { classes: [{ type: 'static', value: "footer-container" }] },
                (parentElement) => [
                this.text('Footer Content')
                ])
            ]);
            this.block('block-content', 'content', (parentElement) => [
            this.html(`block-content-main-1`, "main", parentElement, {}, (parentElement) => [
                this.html(`block-content-main-1-header-1`, "header", parentElement, {}, (parentElement) => [
                    this.html(`block-content-main-1-header-1-nav-1`, "nav", parentElement, {}, (parentElement) => [
                        this.html(`block-content-main-1-header-1-nav-1-a-1`, "a", parentElement,
                            { classes: [{ type: 'static', value: "home" }, { type: 'binding', value: "demo", factory: () => test, stateKeys: [] }], attrs: { "href": { type: 'binding', value: `${App.View.route('web.home')}`, factory: () => `${App.View.route('web.home')}`, stateKeys: [] }, "title": { type: 'binding', value: `${App.Helper.siteinfo('site_name')}`, factory: () => `${App.Helper.siteinfo('site_name')}`, stateKeys: [] } } },
                            (parentElement) => [
                            this.html(`block-content-main-1-header-1-nav-1-a-1-img-1`, "img", parentElement, { classes: [{ type: 'static', value: "site-logo" }, { type: 'binding', value: "has-login", factory: () => userState, stateKeys: ["userState"] }], attrs: { "src": { type: 'binding', value: `${App.Helper.asset('static/web/images/loho.png')}`, factory: () => `${App.Helper.asset('static/web/images/loho.png')}`, stateKeys: [] }, "alt": { type: 'binding', value: `${App.Helper.siteinfo('site_name')}`, factory: () => `${App.Helper.siteinfo('site_name')}`, stateKeys: [] } } })
                            ]),
                        this.html(`block-content-main-1-header-1-nav-1-ul-2`, "ul", parentElement,
                            { classes: [{ type: 'static', value: "site-menu" }] },
                            (parentElement) => [
                            this.reactive(`block-content-main-1-header-1-nav-1-ul-2-foreach-1`, "foreach", parentReactive, parentElement, ["posts"], (parentReactive, parentElement) => {
                                return this.__foreach(posts, (post, __loopKey, __loopIndex, __loop) => [
                                    this.html(`block-content-main-1-header-1-nav-1-ul-2-foreach-1-${__loopIndex}-li-1`, "li", parentElement,
                                        { classes: [{ type: 'static', value: "menu-item" }, { type: 'static', value: "nav-item" }] },
                                        (parentElement) => [
                                        this.html(`block-content-main-1-header-1-nav-1-ul-2-foreach-1-${__loopIndex}-li-1-a-1`, "a", parentElement,
                                            { classes: [{ type: 'static', value: "nav-link" }], attrs: { "href": { type: 'binding', value: `${App.Helper.webPostUrl(post)}`, factory: () => `${App.Helper.webPostUrl(post)}`, stateKeys: [] } } },
                                            (parentElement) => [
                                            this.output(`block-content-main-1-header-1-nav-1-ul-2-foreach-1-${__loopIndex}-li-1-a-1-output-1`, parentElement, true, [], (parentElement) => post.title)
                                            ])
                                        ])
                                ])
                            })
                            ]),
                        this.html(`block-content-main-1-header-1-nav-1-div-3`, "div", parentElement,
                            { classes: [{ type: 'static', value: "account" }] },
                            (parentElement) => [
                            this.reactive(`block-content-main-1-header-1-nav-1-div-3-rc-if-1`, "if", parentReactive, parentElement, ["userState"], (parentReactive, parentElement) => {
                                const reactiveContents = [];
                                if (userState) {
                                    reactiveContents.push(
                                    this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-a-1`, "a", parentElement,
                                        { classes: [{ type: 'static', value: "account-btn" }, { type: 'static', value: "btn-show-menu" }], attrs: { "data-menu-target": { type: 'static', value: "account-menu" }, "href": { type: 'binding', value: `${App.View.route('web.account')}`, factory: () => `${App.View.route('web.account')}`, stateKeys: [] } } },
                                        (parentElement) => [
                                        this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-a-1-img-1`, "img", parentElement, { classes: [{ type: 'static', value: "account-image" }, { type: 'static', value: "user-avatar" }], attrs: { "src": { type: 'binding', value: `${App.Helper.getUserAvatar(userState)}`, factory: () => `${App.Helper.getUserAvatar(userState)}`, stateKeys: ["userState"] }, "alt": { type: 'binding', value: `${userState.name}`, factory: () => `${userState.name}`, stateKeys: ["userState"] } } })
                                        ]),
                                    this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2`, "ul", parentElement,
                                        { classes: [{ type: 'static', value: "account-menu" }], attrs: { "id": { type: 'static', value: "account-menu" } } },
                                        (parentElement) => [
                                        this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-1`, "li", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-1-a-1`, "a", parentElement,
                                                { attrs: { "href": { type: 'binding', value: `${App.View.route('web.account')}`, factory: () => `${App.View.route('web.account')}`, stateKeys: [] } } },
                                                (parentElement) => [
                                                this.output(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-1-a-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('web.account.dashboard'))
                                                ])
                                        ]),
                                        this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-2`, "li", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-2-a-1`, "a", parentElement,
                                                { attrs: { "href": { type: 'binding', value: `${App.View.route('web.account.profile')}`, factory: () => `${App.View.route('web.account.profile')}`, stateKeys: [] } } },
                                                (parentElement) => [
                                                this.output(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-2-a-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('web.account.profile'))
                                                ])
                                        ]),
                                        this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-3`, "li", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-3-a-1`, "a", parentElement,
                                                { attrs: { "href": { type: 'binding', value: `${App.View.route('web.account.change-avatar')}`, factory: () => `${App.View.route('web.account.change-avatar')}`, stateKeys: [] } }, events: { click: [{"handler":"changeAvatar","params":[() => event]}] } },
                                                (parentElement) => [
                                                this.output(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-3-a-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('web.account.change-avatar'))
                                                ])
                                        ]),
                                        this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-4`, "li", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-4-a-1`, "a", parentElement,
                                                { attrs: { "href": { type: 'binding', value: `${App.View.route('web.account.signout')}`, factory: () => `${App.View.route('web.account.signout')}`, stateKeys: [] } }, events: { click: [{"handler":"signout","params":[]}] } },
                                                (parentElement) => [
                                                this.output(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_1-ul-2-li-4-a-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('web.account.signout'))
                                                ])
                                        ])
                                        ])
                                    );
                                }
                                else {
                                    reactiveContents.push(
                                    this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_2-a-1`, "a", parentElement,
                                        { attrs: { "href": { type: 'binding', value: `${App.View.route('web.account.signin')}`, factory: () => `${App.View.route('web.account.signin')}`, stateKeys: [] } } },
                                        (parentElement) => [
                                        this.output(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_2-a-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('web.account.signin'))
                                        ]),
                                    this.html(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_2-a-2`, "a", parentElement,
                                        { attrs: { "href": { type: 'binding', value: `${App.View.route('web.account.signup')}`, factory: () => `${App.View.route('web.account.signup')}`, stateKeys: [] } } },
                                        (parentElement) => [
                                        this.output(`block-content-main-1-header-1-nav-1-div-3-rc-if-1-case_2-a-2-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('web.account.signup'))
                                        ])
                                    );
                                }
                                return reactiveContents;
                            })
                            ])
                    ])
                ]),
                this.html(`block-content-main-1-h1-2`, "h1", parentElement,
                    { classes: [{ type: 'static', value: "page-title" }] },
                    (parentElement) => [
                    this.output(`block-content-main-1-h1-2-output-1`, parentElement, true, [], (parentElement) => title)
                    ]),
                this.html(`block-content-main-1-p-3`, "p", parentElement, {}, (parentElement) => [
                    this.output(`block-content-main-1-p-3-output-1`, parentElement, true, [], (parentElement) => description)
                ]),
                this.html(`block-content-main-1-div-4`, "div", parentElement,
                    { classes: [{ type: 'static', value: "card" }] },
                    (parentElement) => [
                    this.html(`block-content-main-1-div-4-button-1`, "button", parentElement,
                        { events: { click: [(event) => setCounter(counter + 1)] } },
                        (parentElement) => [
                        this.output(`block-content-main-1-div-4-button-1-output-1`, parentElement, true, ["counter"], (parentElement) => App.Helper.text('web.contents.clickme', {"counter": counter}))
                        ])
                    ])
            ])
            ]);
            this.superViewPath = `${__template__+'main'}`;
            return this.extendView(this.superViewPath, {});
            }
        });

    }
}

// Export factory function
export function App(__data__ = {}, systemData = {}) {
    return new AppView(__data__, systemData);
}
export default App;
