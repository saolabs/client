/**
 * Mount danh sách children vào TRƯỚC một anchor node (RUNTIME_CONTRACT.md §2 —
 * insertion point tường minh). Dùng cho Component (@include), và mọi chỗ cần
 * mount content vào giữa cặp markers có sẵn.
 */
export function mountChildrenBeforeAnchor(anchor, children, parentForSao) {
    const container = anchor.parentNode;
    if (!container || !Array.isArray(children))
        return;
    const insert = (node) => container.insertBefore(node, anchor);
    for (const child of children) {
        if (child === null || child === undefined)
            continue;
        if (typeof child === 'string' || typeof child === 'number') {
            insert(document.createTextNode(String(child)));
        }
        else if (child instanceof Node) {
            insert(child);
        }
        else if (typeof child === 'object') {
            if ('element' in child && child.element) {
                insert(child.element);
                child.render?.();
            }
            else if ('openTag' in child) {
                if ('parent' in child)
                    child.parent = parentForSao;
                if ('parentElement' in child)
                    child.parentElement = parentForSao;
                insert(child.openTag);
                insert(child.closeTag);
                child.render?.();
            }
        }
    }
}
/**
 * Hydrate mode: gọi render() đệ quy trên children để tạo JS objects
 * và claim DOM nodes, nhưng KHÔNG appendChild/insertBefore vào DOM
 * (vì DOM đã có từ server-rendered HTML).
 *
 * Khác mountElementList ở chỗ: bỏ mọi thao tác DOM mutation,
 * chỉ giữ lại phần tạo element tree + gán parent.
 */
export function hydrateElementList(root, elements) {
    if (!Array.isArray(elements))
        return;
    for (const element of elements) {
        if (element === null || element === undefined)
            continue;
        if (typeof element === 'string' || typeof element === 'number')
            continue;
        if (element instanceof Node)
            continue;
        if (typeof element === 'object' && 'saoType' in element) {
            const saoEl = element;
            switch (saoEl.saoType) {
                case 'Html': {
                    const html = saoEl;
                    html.render();
                    break;
                }
                case 'TextElement':
                    break;
                case 'Output':
                case 'Reactive':
                case 'Fragment':
                case 'BlockOutlet':
                case 'Block':
                case 'Component':
                case 'Yield': {
                    const saoNode = saoEl;
                    if (typeof saoNode.setParentElement === 'function') {
                        saoNode.setParentElement(root);
                    }
                    else {
                        if ('parent' in saoNode)
                            saoNode.parent = root;
                        if ('parentElement' in saoNode)
                            saoNode.parentElement = root;
                    }
                    saoNode.render();
                    break;
                }
            }
        }
    }
}
/**
 * Mounts a list of SaoNodeInterface elements into a given root HtmlInterface.
 * This function is responsible for appending the DOM nodes of each element
 * to the root's DOM element and returning the list of mounted DOM nodes.
 * @param root - The HtmlInterface to mount the elements into.
 * @param elements - An array of SaoNodeInterface elements to be mounted.
 * @returns An array of the mounted DOM nodes.
 */
export function mountElementList(root, elements) {
    const mountedNodes = [];
    if (Array.isArray(elements)) {
        const rootElement = root.getElement();
        elements.forEach((element) => {
            if (typeof element === 'string' || typeof element === 'number') {
                const el = document.createTextNode(element.toString());
                rootElement.appendChild(el);
                mountedNodes.push(el);
            }
            else if (element instanceof Node) {
                // FIX(baseline#2): raw DOM node — append trực tiếp, trước đây bị drop
                rootElement.appendChild(element);
                mountedNodes.push(element);
            }
            else if (typeof element === 'object' && element !== null && 'saoType' in element) {
                const saoEl = element;
                switch (saoEl.saoType) {
                    case 'Wrapper':
                        const wrapper = saoEl;
                        wrapper.appendTo(root);
                        mountedNodes.push(wrapper.openTag);
                        wrapper.domChildren.forEach((node) => {
                            mountedNodes.push(node);
                        });
                        mountedNodes.push(wrapper.closeTag);
                        break;
                    case 'Html':
                        const html = saoEl;
                        const htmlNode = html.render();
                        rootElement.appendChild(htmlNode);
                        mountedNodes.push(htmlNode);
                        break;
                    case 'TextElement':
                        const textElement = saoEl;
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
                        const saoNode = saoEl;
                        if (typeof saoNode.setParentElement === 'function') {
                            saoNode.setParentElement(root);
                        }
                        else {
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
                            saoNode.nodes.forEach((node) => {
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
    return mountedNodes;
}
export function mountElementListBefore(root, elements) {
    const mountedNodes = [];
    if (Array.isArray(elements)) {
        const rootElement = root.getElement();
        elements.forEach((element) => {
            if (typeof element === 'string' || typeof element === 'number') {
                const el = document.createTextNode(element.toString());
                rootElement.appendChild(el);
                mountedNodes.push(el);
            }
            else if (element instanceof Node) {
                // FIX(baseline#2): raw DOM node — append trực tiếp, trước đây bị drop
                rootElement.appendChild(element);
                mountedNodes.push(element);
            }
            else if (typeof element === 'object' && element !== null && 'saoType' in element) {
                const saoEl = element;
                switch (saoEl.saoType) {
                    case 'Wrapper':
                        const wrapper = saoEl;
                        wrapper.appendTo(root);
                        mountedNodes.push(wrapper.openTag);
                        wrapper.domChildren.forEach((node) => {
                            mountedNodes.push(node);
                        });
                        mountedNodes.push(wrapper.closeTag);
                        break;
                    case 'Html':
                        const html = saoEl;
                        const htmlNode = html.render();
                        rootElement.appendChild(htmlNode);
                        mountedNodes.push(htmlNode);
                        break;
                    case 'TextElement':
                        const textElement = saoEl;
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
                        const saoNode = saoEl;
                        if (typeof saoNode.setParentElement === 'function') {
                            saoNode.setParentElement(root);
                        }
                        else {
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
                            saoNode.nodes.forEach((node) => {
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
    return mountedNodes;
}
//# sourceMappingURL=view.js.map