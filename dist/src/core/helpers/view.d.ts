import type { HtmlInterface, SaoNodeInterface, SaoElementChildren, DOMElement, SaoChildrenFactoryOutput } from "../contracts/ElementInterface";
/**
 * Mount danh sách children vào TRƯỚC một anchor node (RUNTIME_CONTRACT.md §2 —
 * insertion point tường minh). Dùng cho Component (@include), và mọi chỗ cần
 * mount content vào giữa cặp markers có sẵn.
 */
export declare function mountChildrenBeforeAnchor(anchor: Node, children: SaoChildrenFactoryOutput | SaoElementChildren, parentForSao: HtmlInterface | null): void;
/**
 * Hydrate mode: gọi render() đệ quy trên children để tạo JS objects
 * và claim DOM nodes, nhưng KHÔNG appendChild/insertBefore vào DOM
 * (vì DOM đã có từ server-rendered HTML).
 *
 * Khác mountElementList ở chỗ: bỏ mọi thao tác DOM mutation,
 * chỉ giữ lại phần tạo element tree + gán parent.
 */
export declare function hydrateElementList(root: HtmlInterface, elements: SaoElementChildren): void;
/**
 * Mounts a list of SaoNodeInterface elements into a given root HtmlInterface.
 * This function is responsible for appending the DOM nodes of each element
 * to the root's DOM element and returning the list of mounted DOM nodes.
 * @param root - The HtmlInterface to mount the elements into.
 * @param elements - An array of SaoNodeInterface elements to be mounted.
 * @returns An array of the mounted DOM nodes.
 */
export declare function mountElementList(root: HtmlInterface, elements: SaoNodeInterface[] | DOMElement[] | SaoElementChildren): Element[];
export declare function mountElementListBefore(root: HtmlInterface, elements: SaoNodeInterface[] | DOMElement[] | SaoElementChildren): Element[];
//# sourceMappingURL=view.d.ts.map