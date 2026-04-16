import type { OneObjectType } from "../types/utils";
import type { ViewControllerInterface } from "./ViewControllerInterface";
import type { HtmlInterface, OneChildrenFactoryOutput, OneElementChildren, OneNodeInterface } from "./ElementInterface";

// ─── Reactive Interface ──────────────────────────────────────────

/** Reactive region bounded by comment markers — re-renders when deps change */
export interface ReactiveInterface extends OneNodeInterface {
    oneType: OneObjectType;
    id: string;
    type: string;
    ctx: ViewControllerInterface;
    stateKeys: string[];
    parentElement: HtmlInterface | null;
    parentReactive: ReactiveInterface | null;
    openTag: Comment;
    closeTag: Comment;
    children: OneElementChildren;
    unsubscribe: () => void;
    childrenFactory: ReactiveChildrenFactory;
    setChildrenFactory(factory: ReactiveChildrenFactory): void;
    setStateKeys(stateKeys: string[]): void;
    render(): void;
    destroy(): void;
    isOneElement: boolean;
    isOneReactive: boolean;
}

// ─── Reactive Types ──────────────────────────────────────────────

/** Function called by Reactive to produce DOM content between markers */
export type ReactiveRenderFn = (ctx: ViewControllerInterface, parentElement: HtmlInterface | null) => OneChildrenFactoryOutput;

/** Factory function for reactive children rendering */
export type ReactiveChildrenFactory = (parentReactive: ReactiveInterface, parentElement: HtmlInterface | null) => OneChildrenFactoryOutput;

/** Reactive configuration */
export type ReactiveConfig = {
    type?: string;
    id?: string;
    stateKeys?: string[];
    options?: any;
    attributes?: Record<string, any>;
    createdMode?: 'csr' | 'ssr';
}
