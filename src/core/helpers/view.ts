import type { HtmlInterface, SaoNodeInterface, SaoElementChildren, SaoElement, DOMElement, WrapperInterface, TextInterface } from "../contracts/ElementInterface";

/**
 * Mounts a list of SaoNodeInterface elements into a given root HtmlInterface.
 * This function is responsible for appending the DOM nodes of each element
 * to the root's DOM element and returning the list of mounted DOM nodes.
 * @param root - The HtmlInterface to mount the elements into.
 * @param elements - An array of SaoNodeInterface elements to be mounted.
 * @returns An array of the mounted DOM nodes.
 */
export function mountElementList(root: HtmlInterface, elements: SaoNodeInterface[] | DOMElement[] | SaoElementChildren): Element[] {
    const mountedNodes: Array<Element | Text | Comment | Node> = [];
    if (Array.isArray(elements)) {
        const rootElement = root.getElement();
        elements.forEach((element: SaoNodeInterface | DOMElement | string | number) => {
            if (typeof element === 'string' || typeof element === 'number') {
                const el = document.createTextNode(element.toString());
                rootElement.appendChild(el);
                mountedNodes.push(el);
            } else if (typeof element === 'object' && element !== null && 'saoType' in element) {
                const saoEl = element as SaoElement;
                switch (saoEl.saoType) {
                    case 'Wrapper':
                        const wrapper = saoEl as WrapperInterface;
                        wrapper.appendTo(root);
                        mountedNodes.push(wrapper.openTag);
                        wrapper.domChildren.forEach((node: Node) => {
                            mountedNodes.push(node);
                        });
                        mountedNodes.push(wrapper.closeTag);
                        break;
                    case 'Html':
                        const html = saoEl as HtmlInterface;
                        const htmlNode = html.render();
                        rootElement.appendChild(htmlNode);
                        mountedNodes.push(htmlNode);
                        break;
                    case 'TextElement':
                        const textElement = saoEl as TextInterface;
                        const textNode = textElement.render();
                        rootElement.appendChild(textNode);
                        mountedNodes.push(textNode);
                        break;
                    case 'Reactive':
                    case 'Output':
                    case 'Fragment':
                    case 'BlockOutlet':
                    case 'Block':
                    case 'Component':
                    case 'Yield':
                        const saoNode = saoEl as any;
                        if (typeof saoNode.setParentElement === 'function') {
                            saoNode.setParentElement(root);
                        } else {
                            if ('parent' in saoNode) {
                                saoNode.parent = root;
                            }
                            if ('parentElement' in saoNode) {
                                saoNode.parentElement = root;
                            }
                        }
                        saoNode.render();
                        if (saoNode.openTag) {
                            mountedNodes.push(saoNode.openTag);
                        }
                        if (saoEl.saoType === 'Fragment' && Array.isArray(saoNode.nodes)) {
                            saoNode.nodes.forEach((node: Node) => {
                                mountedNodes.push(node);
                            });
                        }
                        if (saoNode.closeTag) {
                            mountedNodes.push(saoNode.closeTag);
                        }
                        break;
                    default:
                        //
                        break;
                }
            }
        });
    }
    return mountedNodes as any;
}

export function mountElementListBefore(root: HtmlInterface, elements: SaoNodeInterface[] | DOMElement[] | SaoElementChildren): Element[] {
    const mountedNodes: Array<Element | Text | Comment | Node> = [];
    if (Array.isArray(elements)) {
        const rootElement = root.getElement();
        elements.forEach((element: SaoNodeInterface | DOMElement | string | number) => {
            if (typeof element === 'string' || typeof element === 'number') {
                const el = document.createTextNode(element.toString());
                rootElement.appendChild(el);
                mountedNodes.push(el);
            } else if (typeof element === 'object' && element !== null && 'saoType' in element) {
                const saoEl = element as SaoElement;
                switch (saoEl.saoType) {
                    case 'Wrapper':
                        const wrapper = saoEl as WrapperInterface;
                        wrapper.appendTo(root);
                        mountedNodes.push(wrapper.openTag);
                        wrapper.domChildren.forEach((node: Node) => {
                            mountedNodes.push(node);
                        });
                        mountedNodes.push(wrapper.closeTag);
                        break;
                    case 'Html':
                        const html = saoEl as HtmlInterface;
                        const htmlNode = html.render();
                        rootElement.appendChild(htmlNode);
                        mountedNodes.push(htmlNode);
                        break;
                    case 'TextElement':
                        const textElement = saoEl as TextInterface;
                        const textNode = textElement.render();
                        rootElement.appendChild(textNode);
                        mountedNodes.push(textNode);
                        break;
                    case 'Reactive':
                    case 'Output':
                    case 'Fragment':
                    case 'BlockOutlet':
                    case 'Block':
                    case 'Component':
                    case 'Yield':
                        const saoNode = saoEl as any;
                        if (typeof saoNode.setParentElement === 'function') {
                            saoNode.setParentElement(root);
                        } else {
                            if ('parent' in saoNode) {
                                saoNode.parent = root;
                            }
                            if ('parentElement' in saoNode) {
                                saoNode.parentElement = root;
                            }
                        }
                        saoNode.render();
                        if (saoNode.openTag) {
                            mountedNodes.push(saoNode.openTag);
                        }
                        if (saoEl.saoType === 'Fragment' && Array.isArray(saoNode.nodes)) {
                            saoNode.nodes.forEach((node: Node) => {
                                mountedNodes.push(node);
                            });
                        }
                        if (saoNode.closeTag) {
                            mountedNodes.push(saoNode.closeTag);
                        }
                        break;
                    default:
                        //
                        break;
                }
            }
        });
    }
    return mountedNodes as any;
}   