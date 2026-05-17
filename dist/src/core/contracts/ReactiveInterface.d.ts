import type { SaoObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { HtmlInterface, SaoChildrenFactoryOutput, SaoElementChildren, SaoNodeInterface } from "./ElementInterface";
/** Reactive region bounded by comment markers — re-renders when deps change */
export interface ReactiveInterface extends SaoNodeInterface {
    saoType: SaoObjectType;
    id: string;
    type: string;
    ctx: ViewControllerInterface;
    stateKeys: string[];
    parentElement: HtmlInterface | null;
    parentReactive: ReactiveInterface | null;
    openTag: Comment;
    closeTag: Comment;
    children: SaoElementChildren;
    unsubscribe: () => void;
    childrenFactory: ReactiveChildrenFactory;
    setChildrenFactory(factory: ReactiveChildrenFactory): void;
    setStateKeys(stateKeys: string[]): void;
    render(): void;
    destroy(): void;
    isSaoElement: boolean;
    isOneReactive: boolean;
}
/** Function called by Reactive to produce DOM content between markers */
export type ReactiveRenderFn = (ctx: ViewControllerInterface, parentElement: HtmlInterface | null) => SaoChildrenFactoryOutput;
/** Factory function for reactive children rendering */
export type ReactiveChildrenFactory = (parentReactive: ReactiveInterface, parentElement: HtmlInterface | null) => SaoChildrenFactoryOutput;
/** Reactive configuration */
export type ReactiveConfig = {
    type?: string;
    id?: string;
    stateKeys?: string[];
    options?: any;
    attributes?: Record<string, any>;
    createdMode?: 'csr' | 'ssr';
};
//# sourceMappingURL=ReactiveInterface.d.ts.map