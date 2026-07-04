import type { SaoObjectType } from "../types/utils";
import type { ViewControllerInterface, ViewType } from "./ViewControllerInterface";
import type { FragmentInterface } from "./ElementInterface";
export interface ViewInterface {
    saoType: SaoObjectType;
    __ctrl__: ViewControllerInterface;
    path: string;
    viewType: ViewType;
    [key: string]: any;
}
/** Render factory for a View — compiled output calls this to build the DOM tree */
export type ViewRenderFactory = () => FragmentInterface | ViewInterface | null;
/** View class constructor signature */
export type ViewConstructor = new (path: string, viewType: 'view' | 'layout' | 'component', viewControllerClass?: any) => ViewInterface;
/**
 * View lifecycle hooks — user có thể cài bất kỳ hook nào (mẫu examples/sao/app.sao).
 * Mỗi transition có cặp before/after:
 *   mount   → mounting / mounted        (gắn vào real DOM)
 *   start   → starting / started        (subscribe reactive + attach events)
 *   pause   → pausing  / paused         (vào PageCache — rời real DOM)
 *   resume  → resuming / resumed        (khôi phục từ PageCache)
 *   stop    → stopping / stopped        (deactivate reactive)
 *   unmount → unmounting / unmounted    (gỡ khỏi real DOM)
 *   destroy → destroying / destroyed    (cleanup toàn bộ)
 */
export interface ViewLifecycleHooks {
    mounting?(): void | Promise<void>;
    mounted?(): void | Promise<void>;
    starting?(): void | Promise<void>;
    started?(): void | Promise<void>;
    pausing?(): void | Promise<void>;
    paused?(): void | Promise<void>;
    resuming?(): void | Promise<void>;
    resumed?(): void | Promise<void>;
    stopping?(): void | Promise<void>;
    stopped?(): void | Promise<void>;
    unmounting?(): void | Promise<void>;
    unmounted?(): void | Promise<void>;
    destroying?(): void | Promise<void>;
    destroyed?(): void | Promise<void>;
    onInit?(): void | Promise<void>;
    onMounted?(): void | Promise<void>;
    onUpdated?(): void | Promise<void>;
    onDestroy?(): void | Promise<void>;
    onActivated?(): void | Promise<void>;
    onDeactivated?(): void | Promise<void>;
    onPause?(): void | Promise<void>;
    onResume?(): void | Promise<void>;
}
//# sourceMappingURL=ViewInterface.d.ts.map