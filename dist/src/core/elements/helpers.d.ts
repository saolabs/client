import { BlockOutletInterface } from "../contracts/BlockInterface.js";
import { FragmentInterface, HtmlInterface, OutputInterface, SaoChildrenFactoryOutput, SaoElementChildren } from "../contracts/ElementInterface.js";
import { ReactiveInterface } from "../contracts/ReactiveInterface.js";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface.js";
import { SaoObjectType } from "../types/utils.js";
export declare function getSaoObjectType(instance: any): SaoObjectType | null;
export declare function parseElementChildren(oneElement: HtmlInterface | ReactiveInterface | BlockOutletInterface | OutputInterface | FragmentInterface | ViewControllerInterface, parentElement: HTMLElement, children: SaoChildrenFactoryOutput): SaoElementChildren;
//# sourceMappingURL=helpers.d.ts.map