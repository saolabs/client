import { View, ViewController, app, Application } from 'saola';


const __VIEW_PATH__ = 'examples.order_management';
const __VIEW_NAMESPACE__ = 'examples.';
const __VIEW_TYPE__ = 'view';
const __VIEW_CONFIG__ = {
    hasSuperView: true,
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



class OrderManagementViewController extends ViewController {
    constructor(view) {
        super(view, __VIEW_PATH__, __VIEW_TYPE__);
        if (typeof (this).setStaticConfig === 'function') {
            (this).setStaticConfig(__VIEW_CONFIG__);
        } else {
            (this).config = __VIEW_CONFIG__;
        }
    }
}

class OrderManagementView extends View {
    constructor(__data__ = {}, systemData = {}) {
        super(__VIEW_PATH__, __VIEW_TYPE__, OrderManagementViewController);
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
        let {pageTitle = 'Quản lý đơn hàng', currentUser = App.Helper.request().user(), filters = {"status": "all", "search": ""}} = __data__;
        const set$orders = __STATE__.__.register('orders');
        let orders = null;
        const setOrders = (state) => {
            orders = state;
            set$orders(state);
        };
        __STATE__.__.setters.setOrders = setOrders;
        __STATE__.__.setters.orders = setOrders;
        const update$orders = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('orders', value);
                orders = value;
            }
        };
        const set$isLoading = __STATE__.__.register('isLoading');
        let isLoading = null;
        const setIsLoading = (state) => {
            isLoading = state;
            set$isLoading(state);
        };
        __STATE__.__.setters.setIsLoading = setIsLoading;
        __STATE__.__.setters.isLoading = setIsLoading;
        const update$isLoading = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('isLoading', value);
                isLoading = value;
            }
        };
        const set$stats = __STATE__.__.register('stats');
        let stats = null;
        const setStats = (state) => {
            stats = state;
            set$stats(state);
        };
        __STATE__.__.setters.setStats = setStats;
        __STATE__.__.setters.stats = setStats;
        const update$stats = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('stats', value);
                stats = value;
            }
        };
        const set$sidebarOpen = __STATE__.__.register('sidebarOpen');
        let sidebarOpen = null;
        const setSidebarOpen = (state) => {
            sidebarOpen = state;
            set$sidebarOpen(state);
        };
        __STATE__.__.setters.setSidebarOpen = setSidebarOpen;
        __STATE__.__.setters.sidebarOpen = setSidebarOpen;
        const update$sidebarOpen = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('sidebarOpen', value);
                sidebarOpen = value;
            }
        };
        const set$debugMode = __STATE__.__.register('debugMode');
        let debugMode = null;
        const setDebugMode = (state) => {
            debugMode = state;
            set$debugMode(state);
        };
        __STATE__.__.setters.setDebugMode = setDebugMode;
        __STATE__.__.setters.debugMode = setDebugMode;
        const update$debugMode = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('debugMode', value);
                debugMode = value;
            }
        };
        const set$totalPages = __STATE__.__.register('totalPages');
        let totalPages = null;
        const setTotalPages = (state) => {
            totalPages = state;
            set$totalPages(state);
        };
        __STATE__.__.setters.setTotalPages = setTotalPages;
        __STATE__.__.setters.totalPages = setTotalPages;
        const update$totalPages = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('totalPages', value);
                totalPages = value;
            }
        };
        const set$currentPage = __STATE__.__.register('currentPage');
        let currentPage = null;
        const setCurrentPage = (state) => {
            currentPage = state;
            set$currentPage(state);
        };
        __STATE__.__.setters.setCurrentPage = setCurrentPage;
        __STATE__.__.setters.currentPage = setCurrentPage;
        const update$currentPage = (value) => {
            if(__STATE__.__.canUpdateStateByKey){
                updateStateByKey('currentPage', value);
                currentPage = value;
            }
        };
        let i = 3;
        let i = i - 1;
        let i = 3;
        let i = i - 1;
        __UPDATE_DATA_TRAIT__.pageTitle = value => pageTitle = value;
        __UPDATE_DATA_TRAIT__.currentUser = value => currentUser = value;
        __UPDATE_DATA_TRAIT__.filters = value => filters = value;
        __UPDATE_DATA_TRAIT__.i = value => i = value;
        __UPDATE_DATA_TRAIT__.i = value => i = value;
        __UPDATE_DATA_TRAIT__.i = value => i = value;
        __UPDATE_DATA_TRAIT__.i = value => i = value;
        const __VARIABLE_LIST__ = ["pageTitle", "currentUser", "filters", "i", "i", "i", "i"];


        this.__ctrl__.setUserDefinedConfig({
            async onMounted() {
                    this.fetchOrders();
                },
                async fetchOrders() {
                    this.isLoading = true;
                    try {
                        // Giả lập API call
                        const data = await api.get('/orders', this.filters);
                        this.orders = data.items;
                        this.stats = data.stats;
                    } catch (e) {
                        console.error(e);
                    } finally {
                        this.isLoading = false;
                    }
                },
                viewDetail(id) {
                    router.push(`/orders/${id}`);
                },
                setStatusFilter(val) {
                    this.filters.status = val;
                    this.fetchOrders();
                },
                searchOrders(val) {
                    this.filters.search = val;
                    this.fetchOrders();
                }
        });

        this.__ctrl__.setup({
            superView: 'layouts.admin',
            subscribe: true,
            fetch: null,
            data: __data__,
            viewId: __VIEW_ID__,
            path: __VIEW_PATH__,
            scripts: [],
            styles: [{"type":"code","content":".admin-wrapper {\n        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n        padding: 2rem;\n        background: #f8fafc;\n        min-height: 100vh;\n    }\n    .status-dot {\n        display: inline-block;\n        width: 8px;\n        height: 8px;\n        border-radius: 50%;\n        margin-right: 6px;\n    }\n    .status-pending { background: #f59e0b; }\n    .status-completed { background: #10b981; }\n    .status-cancelled { background: #ef4444; }\n    \n    .spinner {\n        border: 3px solid #f3f3f3;\n        border-top: 3px solid #3b82f6;\n        border-radius: 50%;\n        width: 24px;\n        height: 24px;\n        animation: spin 1s linear infinite;\n        margin: 0 auto 1rem;\n    }\n    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\n\n    .page-link {\n        padding: 0.5rem 1rem;\n        border: 1px solid #e2e8f0;\n        border-radius: 0.375rem;\n        background: white;\n        cursor: pointer;\n    }\n    .page-link.active {\n        background: #3b82f6;\n        color: white;\n        border-color: #3b82f6;\n    }\n    .btn-icon {\n        padding: 4px;\n        border-radius: 4px;\n        border: none;\n        background: transparent;\n        cursor: pointer;\n    }\n    .btn-icon:hover {\n        background: #f1f5f9;\n    }"}],
            resources: [],
            commitConstructorData: function() {
                // Then update states from data
                update$orders([]);
                update$isLoading(true);
                update$stats({"total": 0, "revenue": 0});
                update$sidebarOpen(true);
                update$debugMode(true);
                update$totalPages(10);
                update$currentPage(1);
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
                update$orders([]);
                update$isLoading(true);
                update$stats({"total": 0, "revenue": 0});
                update$sidebarOpen(true);
                update$debugMode(true);
                update$totalPages(10);
                update$currentPage(1);
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
            this.block('block-content', 'content', (parentElement) => [
            this.html(`block-content-div-1`, "div", parentElement,
                { classes: [{ type: 'static', value: "admin-wrapper" }, { type: 'binding', value: "sidebar-collapsed", factory: () => !sidebarOpen, stateKeys: ["sidebarOpen"] }] },
                (parentElement) => [
                this.html(`block-content-div-1-header-1`, "header", parentElement,
                    { classes: [{ type: 'static', value: "flex" }, { type: 'static', value: "justify-between" }, { type: 'static', value: "items-center" }, { type: 'static', value: "mb-8" }] },
                    (parentElement) => [
                    this.html(`block-content-div-1-header-1-h1-1`, "h1", parentElement, {}, (parentElement) => [
                        this.output(`block-content-div-1-header-1-h1-1-output-1`, parentElement, true, [], (parentElement) => pageTitle)
                    ]),
                    this.html(`block-content-div-1-header-1-div-2`, "div", parentElement,
                        { classes: [{ type: 'static', value: "user-profile" }, { type: 'static', value: "flex" }, { type: 'static', value: "items-center" }, { type: 'static', value: "gap-3" }] },
                        (parentElement) => [
                        this.reactive(`block-content-div-1-header-1-div-2-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive, parentElement) => {
                            const reactiveContents = [];
                            if (currentUser && currentUser.is_admin) {
                                reactiveContents.push(
                                this.html(`block-content-div-1-header-1-div-2-rc-if-1-case_1-span-1`, "span", parentElement,
                                    { classes: [{ type: 'static', value: "badge" }, { type: 'static', value: "badge-admin" }] },
                                    (parentElement) => [
                                    this.text('Admin Mode')
                                    ]),
                                this.text('} @else {'),
                                this.html(`block-content-div-1-header-1-div-2-rc-if-1-case_1-span-2`, "span", parentElement,
                                    { classes: [{ type: 'static', value: "badge" }, { type: 'static', value: "badge-staff" }] },
                                    (parentElement) => [
                                    this.text('Staff')
                                    ]),
                                this.text('}'),
                                this.reactive(`block-content-div-1-header-1-div-2-rc-if-1-case_1-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive, parentElement) => {
                                    const reactiveContents = [];
                                    if (currentUser) {
                                        reactiveContents.push(
                                        this.html(`block-content-div-1-header-1-div-2-rc-if-1-case_1-rc-if-1-case_1-img-1`, "img", parentElement, { classes: [{ type: 'static', value: "w-10" }, { type: 'static', value: "h-10" }, { type: 'static', value: "rounded-full" }], attrs: { "alt": { type: 'static', value: "avatar" }, "src": { type: 'binding', value: `${currentUser.avatar}`, factory: () => `${currentUser.avatar}`, stateKeys: [] } } }),
                                        this.text('}')
                                        );
                                    }
                                    return reactiveContents;
                                })
                                );
                            }
                            return reactiveContents;
                        })
                        ])
                    ]),
                this.html(`block-content-div-1-div-2`, "div", parentElement,
                    { classes: [{ type: 'static', value: "grid" }, { type: 'static', value: "grid-cols-4" }, { type: 'static', value: "gap-4" }, { type: 'static', value: "mb-6" }] },
                    (parentElement) => [
                    this.text('@each (key, value in stats) {'),
                    this.html(`block-content-div-1-div-2-div-1`, "div", parentElement,
                        { classes: [{ type: 'static', value: "stat-card" }, { type: 'static', value: "p-4" }, { type: 'static', value: "bg-white" }, { type: 'static', value: "shadow" }, { type: 'static', value: "rounded-lg" }] },
                        (parentElement) => [
                        this.html(`block-content-div-1-div-2-div-1-label-1`, "label", parentElement,
                            { classes: [{ type: 'static', value: "text-gray-500" }, { type: 'static', value: "uppercase" }, { type: 'static', value: "text-xs" }, { type: 'static', value: "font-bold" }] },
                            (parentElement) => [
                            this.output(`block-content-div-1-div-2-div-1-label-1-output-1`, parentElement, true, [], (parentElement) => key)
                            ]),
                        this.html(`block-content-div-1-div-2-div-1-div-2`, "div", parentElement,
                            { classes: [{ type: 'static', value: "text-2xl" }, { type: 'static', value: "font-semibold" }] },
                            (parentElement) => [
                            this.reactive(`block-content-div-1-div-2-div-1-div-2-rc-switch-1`, "switch", parentReactive, parentElement, [], (parentReactive, parentElement) => {
                                const reactiveContents = [];
                                switch (key) {
                                    case 'revenue':
                                        reactiveContents.push(
                                        this.html(`block-content-div-1-div-2-div-1-div-2-rc-switch-1-case_1-span-1`, "span", parentElement, {}, (parentElement) => [
                                            this.text('$'),
                                            this.output(`block-content-div-1-div-2-div-1-div-2-rc-switch-1-case_1-span-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.formatMoney(value))
                                        ]),
                                        this.text('@default:'),
                                        this.html(`block-content-div-1-div-2-div-1-div-2-rc-switch-1-case_1-span-2`, "span", parentElement, {}, (parentElement) => [
                                            this.output(`block-content-div-1-div-2-div-1-div-2-rc-switch-1-case_1-span-2-output-1`, parentElement, true, [], (parentElement) => value)
                                        ]),
                                        this.text('}')
                                        );
                                        break;
                                }
                                return reactiveContents;
                            })
                            ])
                        ]),
                    this.text('}')
                    ]),
                this.html(`block-content-div-1-section-3`, "section", parentElement,
                    { classes: [{ type: 'static', value: "filters-bar" }, { type: 'static', value: "mb-6" }, { type: 'static', value: "p-4" }, { type: 'static', value: "bg-gray-50" }, { type: 'static', value: "rounded" }, { type: 'static', value: "flex" }, { type: 'static', value: "gap-4" }] },
                    (parentElement) => [
                    this.html(`block-content-div-1-section-3-input-1`, "input", parentElement, { attrs: { "type": { type: 'static', value: "text" }, "placeholder": { type: 'static', value: "Tìm mã đơn hàng..." } }, events: { input: [{"handler":"searchOrders","params":[event.target.value]}] } }),
                    this.html(`block-content-div-1-section-3-select-2`, "select", parentElement,
                        { events: { change: [{"handler":"setStatusFilter","params":[event.target.value]}] } },
                        (parentElement) => [
                        this.text('@each (status in [\'all\', \'pending\', \'shipping\', \'completed\', \'cancelled\']) {'),
                        this.html(`block-content-div-1-section-3-select-2-option-1`, "option", parentElement,
                            { attrs: { "selected": { type: 'static', value: true }, "filters": { type: 'static', value: true }, "status": { type: 'static', value: true }, "value": { type: 'binding', value: `${status}`, factory: () => `${status}`, stateKeys: [] } } },
                            (parentElement) => [
                            this.output(`block-content-div-1-section-3-select-2-option-1-output-1`, parentElement, true, [], (parentElement) => App.Helper.text('status.' + status))
                            ]),
                        this.text('}')
                        ])
                    ]),
                this.html(`block-content-div-1-div-4`, "div", parentElement,
                    { classes: [{ type: 'static', value: "table-responsive" }, { type: 'static', value: "bg-white" }, { type: 'static', value: "rounded-xl" }, { type: 'static', value: "shadow-sm" }, { type: 'static', value: "overflow-hidden" }] },
                    (parentElement) => [
                    this.reactive(`block-content-div-1-div-4-rc-if-1`, "if", parentReactive, parentElement, ["isLoading"], (parentReactive, parentElement) => {
                        const reactiveContents = [];
                        if (isLoading) {
                            reactiveContents.push(
                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-1`, "div", parentElement,
                                { classes: [{ type: 'static', value: "p-20" }, { type: 'static', value: "text-center" }] },
                                (parentElement) => [
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-1-div-1`, "div", parentElement, { classes: [{ type: 'static', value: "spinner" }] }),
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-1-p-2`, "p", parentElement, {}, (parentElement) => [
                                    this.text('Đang tải dữ liệu đơn hàng...')
                                ])
                                ]),
                            this.text('} @elseif($orders && count($orders) > 0) {'),
                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2`, "table", parentElement,
                                { classes: [{ type: 'static', value: "w-full" }, { type: 'static', value: "text-left" }] },
                                (parentElement) => [
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1`, "thead", parentElement,
                                    { classes: [{ type: 'static', value: "bg-gray-100" }, { type: 'static', value: "border-b" }] },
                                    (parentElement) => [
                                    this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1`, "tr", parentElement, {}, (parentElement) => [
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-1`, "th", parentElement, {}, (parentElement) => [
                                            this.text('ID')
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-2`, "th", parentElement, {}, (parentElement) => [
                                            this.text('Khách hàng')
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-3`, "th", parentElement, {}, (parentElement) => [
                                            this.text('Sản phẩm')
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-4`, "th", parentElement, {}, (parentElement) => [
                                            this.text('Trạng thái')
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-5`, "th", parentElement, {}, (parentElement) => [
                                            this.text('Tổng tiền')
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-thead-1-tr-1-th-6`, "th", parentElement, {}, (parentElement) => [
                                            this.text('Thao tác')
                                        ])
                                    ])
                                    ]),
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2`, "tbody", parentElement, {}, (parentElement) => [
                                    this.text('@each (order in orders) {'),
                                    this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1`, "tr", parentElement,
                                        { classes: [{ type: 'static', value: "hover:bg-gray-50" }, { type: 'static', value: "transition-colors" }, { type: 'static', value: "border-b" }] },
                                        (parentElement) => [
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-1`, "td", parentElement,
                                            { classes: [{ type: 'static', value: "font-mono" }, { type: 'static', value: "text-blue-600" }] },
                                            (parentElement) => [
                                            this.text('#'),
                                            this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-1-output-1`, parentElement, true, [], (parentElement) => order.id)
                                            ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2`, "td", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2-div-1`, "div", parentElement,
                                                { classes: [{ type: 'static', value: "font-bold" }] },
                                                (parentElement) => [
                                                this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2-div-1-output-1`, parentElement, true, [], (parentElement) => order.customer.name)
                                                ]),
                                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2-div-2`, "div", parentElement,
                                                { classes: [{ type: 'static', value: "text-xs" }, { type: 'static', value: "text-gray-400" }] },
                                                (parentElement) => [
                                                this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-2-div-2-output-1`, parentElement, true, [], (parentElement) => order.customer.email)
                                                ])
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3`, "td", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3-ul-1`, "ul", parentElement,
                                                { classes: [{ type: 'static', value: "item-list" }] },
                                                (parentElement) => [
                                                this.text('@each (item in order.items) {'),
                                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3-ul-1-li-1`, "li", parentElement,
                                                    { classes: [{ type: 'static', value: "text-sm" }] },
                                                    (parentElement) => [
                                                    this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3-ul-1-li-1-output-1`, parentElement, true, [], (parentElement) => item.qty),
                                                    this.text('x '),
                                                    this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-3-ul-1-li-1-output-2`, parentElement, true, [], (parentElement) => item.name)
                                                    ]),
                                                this.text('}')
                                                ])
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-4`, "td", parentElement, {}, (parentElement) => [
                                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-4-span-1`, "span", parentElement, { classes: [{ type: 'static', value: "status-dot" }, { type: 'static', value: "status-' + $order->status" }] }),
                                            this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-4-output-1`, parentElement, true, [], (parentElement) => order.status_label)
                                        ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-5`, "td", parentElement,
                                            { classes: [{ type: 'static', value: "font-bold" }] },
                                            (parentElement) => [
                                            this.text('$'),
                                            this.output(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-5-output-1`, parentElement, true, [], (parentElement) => order.total_amount)
                                            ]),
                                        this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6`, "td", parentElement,
                                            { classes: [{ type: 'static', value: "actions" }] },
                                            (parentElement) => [
                                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-button-1`, "button", parentElement,
                                                { classes: [{ type: 'static', value: "btn-icon" }], events: { click: [{"handler":"viewDetail","params":[order.id]}] } },
                                                (parentElement) => [
                                                this.text('👁️')
                                                ]),
                                            this.reactive(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-rc-if-1`, "if", parentReactive, parentElement, [], (parentReactive, parentElement) => {
                                                const reactiveContents = [];
                                                if (order.status == 'pending' && currentUser.can('edit_orders')) {
                                                    reactiveContents.push(
                                                    this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-rc-if-1-case_1-button-1`, "button", parentElement,
                                                        { classes: [{ type: 'static', value: "btn-icon" }, { type: 'static', value: "text-green-500" }], events: { click: [{"handler":"approveOrder","params":[order.id]}] } },
                                                        (parentElement) => [
                                                        this.text('✅')
                                                        ]),
                                                    this.text('}'),
                                                    this.html(`block-content-div-1-div-4-rc-if-1-case_1-table-2-tbody-2-tr-1-td-6-rc-if-1-case_1-button-2`, "button", parentElement,
                                                        { classes: [{ type: 'static', value: "btn-icon" }, { type: 'static', value: "text-red-500" }], events: { click: [{"handler":"deleteOrder","params":[order.id]}] } },
                                                        (parentElement) => [
                                                        this.text('🗑️')
                                                        ])
                                                    );
                                                }
                                                return reactiveContents;
                                            })
                                            ])
                                        ]),
                                    this.text('}')
                                ])
                                ]),
                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-footer-3`, "footer", parentElement,
                                { classes: [{ type: 'static', value: "pagination" }, { type: 'static', value: "p-4" }, { type: 'static', value: "flex" }, { type: 'static', value: "justify-center" }, { type: 'static', value: "gap-2" }] },
                                (parentElement) => [
                                this.reactive(`block-content-div-1-div-4-rc-if-1-case_1-footer-3-for-1`, "for", parentReactive, parentElement, ["totalPages"], (parentReactive, parentElement) => {
                                    return this.__for("increment", 1, totalPages, (__loop) => {
                                        let __forOutput = [];
                                        for (let i = 1; i <= totalPages; i++) {
                                            __loop.setCurrentTimes(i);
                                            __forOutput.push(
                                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-footer-3-for-1-${i}-button-1`, "button", parentElement,
                                                { classes: [{ type: 'static', value: "page-link" }, { type: 'binding', value: "active", factory: () => i == currentPage, stateKeys: ["currentPage"] }], events: { click: [{"handler":"goToPage","params":[() => i]}] } },
                                                (parentElement) => [
                                                this.output(`block-content-div-1-div-4-rc-if-1-case_1-footer-3-for-1-${i}-button-1-output-1`, parentElement, true, ["i"], (parentElement) => i)
                                                ]),
                                            this.text('}')
                                            );
                                        }
                                        return __forOutput;
                                    })
                                })
                                ]),
                            this.text('} @else {'),
                            this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-4`, "div", parentElement,
                                { classes: [{ type: 'static', value: "empty-state" }, { type: 'static', value: "p-20" }, { type: 'static', value: "text-center" }] },
                                (parentElement) => [
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-4-img-1`, "img", parentElement, { classes: [{ type: 'static', value: "mx-auto" }, { type: 'static', value: "mb-4" }], attrs: { "src": { type: 'static', value: "/static/empty-orders.svg" } } }),
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-4-h3-2`, "h3", parentElement, {}, (parentElement) => [
                                    this.text('Không tìm thấy đơn hàng nào')
                                ]),
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-4-p-3`, "p", parentElement, {}, (parentElement) => [
                                    this.text('Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.')
                                ]),
                                this.html(`block-content-div-1-div-4-rc-if-1-case_1-div-4-button-4`, "button", parentElement,
                                    { classes: [{ type: 'static', value: "btn-primary" }, { type: 'static', value: "mt-4" }], events: { click: [{"handler":"resetFilters","params":[]}] } },
                                    (parentElement) => [
                                    this.text('Xóa bộ lọc')
                                    ])
                                ]),
                            this.text('}')
                            );
                        }
                        return reactiveContents;
                    })
                    ]),
                this.reactive(`block-content-div-1-rc-if-1`, "if", parentReactive, parentElement, ["debugMode"], (parentReactive, parentElement) => {
                    const reactiveContents = [];
                    if (debugMode) {
                        reactiveContents.push(
                        this.html(`block-content-div-1-rc-if-1-case_1-div-1`, "div", parentElement,
                            { classes: [{ type: 'static', value: "debug-panel" }, { type: 'static', value: "fixed" }, { type: 'static', value: "bottom-0" }, { type: 'static', value: "right-0" }, { type: 'static', value: "p-4" }, { type: 'static', value: "bg-black" }, { type: 'static', value: "text-green-400" }, { type: 'static', value: "font-mono" }, { type: 'static', value: "text-xs" }, { type: 'static', value: "opacity-75" }] },
                            (parentElement) => [
                            this.__while((loopCtx) => {
                                    loopCtx.setCount(0);
                                let __whileOutput = [];
                                while (i > 0) {
                                    loopCtx.setCurrentTimes(i);
                                    __whileOutput.push(
                                        this.html(`block-content-div-1-rc-if-1-case_1-div-1-while-1-${i}-div-1`, "div", parentElement, {}, (parentElement) => [
                                            this.text('[DEBUG] System health check: OK ('),
                                            this.output(`block-content-div-1-rc-if-1-case_1-div-1-while-1-${i}-div-1-output-1`, parentElement, true, ["i"], (parentElement) => i),
                                            this.text(')')
                                        ]),
                                        this.text('}')
                                    );
                                }
                                return __whileOutput;
                            }, 0)
                            ]),
                        this.text('}')
                        );
                    }
                    return reactiveContents;
                })
                ])
            ]);
            this.superViewPath = __layout__ + 'layouts.admin';
            return this.extendView(this.superViewPath, {});
            }
        });

    }
}

// Export factory function
export function OrderManagement(__data__ = {}, systemData = {}) {
    return new OrderManagementView(__data__, systemData);
}
export default OrderManagement;
