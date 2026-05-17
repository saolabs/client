import { BlockOutletInterface } from "../contracts/BlockInterface";
import { FragmentInterface, HtmlInterface, OutputInterface, SaoChildrenFactoryOutput, SaoElementChildren } from "../contracts/ElementInterface";
import { ReactiveInterface } from "../contracts/ReactiveInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SaoObjectType } from "../types/utils";
export declare function getSaoObjectType(instance: any): SaoObjectType | null;
export declare function parseElementChildren(oneElement: HtmlInterface | ReactiveInterface | BlockOutletInterface | OutputInterface | FragmentInterface | ViewControllerInterface, parentElement: HTMLElement, children: SaoChildrenFactoryOutput): SaoElementChildren;
//# sourceMappingURL=helpers.d.ts.map