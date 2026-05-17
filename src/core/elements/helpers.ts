import { BlockInterface, BlockOutletInterface } from "../contracts/BlockInterface";
import { FragmentInterface, HtmlInterface, OutputInterface, SaoChildrenFactoryOutput, SaoElementChildren } from "../contracts/ElementInterface";
import { ReactiveInterface } from "../contracts/ReactiveInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { SaoObjectType } from "../types/utils";

export function getSaoObjectType(instance: any): SaoObjectType | null {
    if (instance && typeof instance === 'object' && 'saoType' in instance) {
        return instance.saoType;
    }
    return null;
}

export function parseElementChildren(
    oneElement: HtmlInterface | ReactiveInterface | BlockOutletInterface | OutputInterface | FragmentInterface | ViewControllerInterface, 
    parentElement: HTMLElement,
    children: SaoChildrenFactoryOutput
): SaoElementChildren {
    const parsedChildren: SaoElementChildren = [];

    if(!children || !Array.isArray(children)) {
        console.warn('Children factory returned invalid output (not an array):', children);
        return parsedChildren;
    }

    children.forEach(child => {
        if (typeof child === 'string' || typeof child === 'number') {
            const textNode = document.createTextNode(String(child));
            parsedChildren.push(textNode);
            return;
        }
        if(child instanceof Node) {
            // Direct DOM node (e.g. from a third-party library) — append as-is
            parsedChildren.push(child);
            return;
        }
        if (!child || typeof child !== 'object' || child === null) {
            // Skip invalid child types (null, undefined, non-objects, non-DOM nodes)
            console.warn('Skipping invalid child:', child);
            return;
        } 
        let childType: SaoObjectType = getSaoObjectType(child);
        if(!childType) {
            return;
        }
        switch (childType) {
            case 'Html':

            
            break;
        }
    });


    return parsedChildren;
}