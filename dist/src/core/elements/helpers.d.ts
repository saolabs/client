import { BlockOutletInterface } from "../contracts/BlockInterface";
import { FragmentInterface, HtmlInterface, OutputInterface, OneChildrenFactoryOutput, OneElementChildren } from "../contracts/ElementInterface";
import { ReactiveInterface } from "../contracts/ReactiveInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { OneObjectType } from "../types/utils";
export declare function getOneObjectType(instance: any): OneObjectType | null;
export declare function parseElementChildren(oneElement: HtmlInterface | ReactiveInterface | BlockOutletInterface | OutputInterface | FragmentInterface | ViewControllerInterface, parentElement: HTMLElement, children: OneChildrenFactoryOutput): OneElementChildren;
//# sourceMappingURL=helpers.d.ts.map