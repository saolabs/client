export function getOneObjectType(instance) {
    if (instance && typeof instance === 'object' && 'oneType' in instance) {
        return instance.oneType;
    }
    return null;
}
export function parseElementChildren(oneElement, parentElement, children) {
    const parsedChildren = [];
    if (!children || !Array.isArray(children)) {
        console.warn('Children factory returned invalid output (not an array):', children);
        return parsedChildren;
    }
    children.forEach(child => {
        if (typeof child === 'string' || typeof child === 'number') {
            const textNode = document.createTextNode(String(child));
            parsedChildren.push(textNode);
            return;
        }
        if (child instanceof Node) {
            // Direct DOM node (e.g. from a third-party library) — append as-is
            parsedChildren.push(child);
            return;
        }
        if (!child || typeof child !== 'object' || child === null) {
            // Skip invalid child types (null, undefined, non-objects, non-DOM nodes)
            console.warn('Skipping invalid child:', child);
            return;
        }
        let childType = getOneObjectType(child);
        if (!childType) {
            return;
        }
        switch (childType) {
            case 'Html':
                break;
        }
    });
    return parsedChildren;
}
//# sourceMappingURL=helpers.js.map