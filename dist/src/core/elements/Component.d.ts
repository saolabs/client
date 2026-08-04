import { InitMode } from "../contracts/common";
import { ComponentInterface } from "../contracts/ComponentInterface";
import { HtmlInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { ViewInterface } from "../contracts/ViewInterface";
import { SaoObjectType } from "../types/utils";
export declare class Component implements ComponentInterface {
    saoType: SaoObjectType;
    ctx: ViewControllerInterface;
    parent: HtmlInterface | null;
    domChildren: Node[];
    stateKeys: string[];
    data: Record<string, any>;
    openTag: Comment;
    closeTag: Comment;
    viewRef: ViewInterface | null;
    id: string;
    path: string | null;
    type: 'default' | 'if' | 'when';
    condition: {
        stateKeys: string[];
        checker: () => any;
    } | null;
    initMode: InitMode;
    subscribeFn: () => void;
    unsubscribeFn: () => void;
    dataFactory: ((parentElement: HtmlInterface | null) => Record<string, any>) | null;
    constructor({ ctx, parent, id, stateKeys, data, dataFactory, path, type, condition, initMode, }: {
        ctx: ViewControllerInterface;
        parent?: HtmlInterface | null;
        id?: string | null;
        stateKeys?: string[];
        data?: Record<string, any>;
        dataFactory?: ((parentElement: HtmlInterface | null) => Record<string, any>) | null;
        path?: string | null;
        type?: 'default' | 'if' | 'when';
        condition?: {
            stateKeys: string[];
            checker: () => any;
        } | null;
        initMode?: InitMode;
    });
    /**
     * Tìm cặp marker component từ server-rendered HTML (format chuẩn §5.1):
     *   open: s:c:{id}-s   close: s:c:{id}-e
     */
    private claimSSRMarkers;
    mergeData(newData: Record<string, any>): void;
    setDataFactory(factory: (parentElement: HtmlInterface | null) => Record<string, any>): void;
    setCondition(condition: {
        stateKeys: string[];
        checker: () => any;
    }): void;
    setStateKeys(stateKeys: string[]): void;
    setParentElement(parent: HtmlInterface | null): void;
    setView(view: ViewInterface): void;
    setParent(parent: HtmlInterface | null): void;
    /** Registry guard */
    __destroyed__: boolean;
    private _isStarted;
    private unsubscribeData;
    private unsubscribeCondition;
    /** 'when' type: trạng thái mounted hiện tại của child */
    private _childMounted;
    /**
     * Render — @include (RUNTIME_CONTRACT.md §2):
     *   1. Đặt component markers (idempotent — caller có thể đã đặt đúng vị trí)
     *   2. Resolve child view từ registry (App.View)
     *   3. Render child wrapper GIỮA markers, liên kết parent ↔ child
     *   4. commitData cho child (start sẽ do lifecycle cascade gọi)
     *
     * Hydrate mode (markers claim được từ SSR): child view được tạo với đúng
     * viewId server đã dùng (discover từ marker view bên trong) → toàn bộ cây
     * con CLAIM DOM server thay vì tạo mới — SSR/CSR cho cùng kết quả.
     */
    render(): void;
    /**
     * Error boundary cho subtree con (@include). Boundary được tìm từ ctx —
     * controller CHỨA @include này, không phải view con — nên onError của một
     * view không bắt lỗi render của chính nó (giống React ErrorBoundary).
     * Không boundary nào xử lý → rethrow, giữ nguyên hành vi cũ (bubble lên
     * try/catch của renderPageView).
     */
    private guardChildMount;
    /** Dọn DOM dở dang của lần render lỗi rồi chèn fallback giữa cặp marker. */
    private mountFallback;
    /**
     * Discover viewId server đã dùng cho child view: quét comment giữa cặp
     * marker component, tìm marker view mở đầu tiên <!--s:v:{id}-s-->.
     */
    private discoverChildViewId;
    /**
     * Hydrate child view — thứ tự chuẩn hydration (như ViewManager.hydrateView):
     * discover viewId → tạo instance → commit state → flush discard →
     * render claim DOM → mount() (hook + asset). KHÔNG chèn node mới.
     */
    private hydrateChild;
    /** Tạo + mount child view giữa markers (nếu chưa có) */
    private mountChild;
    /** Resolve one child instance and establish ownership before either DOM strategy. */
    private resolveChildView;
    /** Hydration mounts after commit/claim; CSR commits immediately after mount. */
    private finishChildMount;
    private markChildMounted;
    /** Gỡ child (when=false hoặc destroy) */
    private unmountChild;
    /**
     * Start — kích hoạt child + subscribe:
     *   - stateKeys: props reactive — đổi → dataFactory mới → child.updateData()
     *   - condition (type 'when'): đổi → mount/unmount child
     */
    start(): void;
    stop(): void;
    destroy(): void;
    get isSaoElement(): boolean;
    set isSaoElement(value: boolean);
    get isOneComponent(): boolean;
    set isOneComponent(value: boolean);
}
//# sourceMappingURL=Component.d.ts.map