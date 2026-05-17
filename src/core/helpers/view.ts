import { HtmlInterface, SaoNodeInterface } from "../contracts/ElementInterface";

/**
 * Mounts a list of SaoNodeInterface elements into a given root HtmlInterface.
 * This function is responsible for appending the DOM nodes of each element
 * to the root's DOM element and returning the list of mounted DOM nodes.
 * @param root - The HtmlInterface to mount the elements into.
 * @param elements - An array of SaoNodeInterface elements to be mounted.
 * @returns An array of the mounted DOM nodes.
 */
export function mountElementList(root: HtmlInterface, elements: SaoNodeInterface[]): Element[] {
    const mountedNodes: Element[] = [];

    return mountedNodes;
}