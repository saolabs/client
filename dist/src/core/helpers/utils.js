export function generateUUID(length = 36) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    }).substring(0, length);
}
const htmlEscapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
const htmlEscapeRe = /[&<>"']/g;
export function escapeHTML(str) {
    return str.replace(htmlEscapeRe, (ch) => htmlEscapeMap[ch]);
}
export function isEmpty(value) {
    if (value == null)
        return true;
    if (typeof value === 'string' && value.trim() === '')
        return true;
    if (Array.isArray(value) && value.length === 0)
        return true;
    if (typeof value === 'object' && Object.keys(value).length === 0)
        return true;
    return false;
}
export function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function hasProperty(obj, prop) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, prop);
}
export function hasMethod(obj, method) {
    return obj != null && typeof obj[method] === 'function';
}
export function hasAnyProperty(obj, props) {
    return obj != null && props.some(prop => Object.prototype.hasOwnProperty.call(obj, prop));
}
export function hasData(value) {
    return isObject(value) && Object.keys(value).length > 0;
}
export function isArray(value) {
    return Array.isArray(value);
}
export function isString(value) {
    return typeof value === 'string';
}
export function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}
export function isBoolean(value) {
    return typeof value === 'boolean';
}
export function isFunction(value) {
    return typeof value === 'function';
}
export function isPromise(value) {
    return value instanceof Promise || (value !== null && typeof value === 'object' && typeof value.then === 'function');
}
export function isHTMLElement(value) {
    return value instanceof HTMLElement;
}
export function isNode(value) {
    return value instanceof Node;
}
export function isCommentNode(value) {
    return value instanceof Comment;
}
export function isTextNode(value) {
    return value instanceof Text;
}
export function isSaoElement(value) {
    return value && typeof value === 'object' && 'isSaoElement' in value && value.isSaoElement === true;
}
export function isOneHtml(value) {
    return value && typeof value === 'object' && 'isOneHtml' in value && value.isOneHtml === true;
}
export function isOneText(value) {
    return value && typeof value === 'object' && 'isOneText' in value && value.isOneText === true;
}
export function isOneNativeElement(value) {
    return value && typeof value === 'object' && 'isOneNativeElement' in value && value.isOneNativeElement === true;
}
export function isOneReactive(value) {
    return value && typeof value === 'object' && 'isOneReactive' in value && value.isOneReactive === true;
}
export function isSaoFragment(value) {
    return value && typeof value === 'object' && 'isSaoFragment' in value && value.isSaoFragment === true;
}
export function isOneBlock(value) {
    return value && typeof value === 'object' && 'isOneBlock' in value && value.isOneBlock === true;
}
//# sourceMappingURL=utils.js.map