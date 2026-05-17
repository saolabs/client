export function generateUUID(length: number = 36): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    }).substring(0, length);
}
const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};
const htmlEscapeRe = /[&<>"']/g;

export function escapeHTML(str: string): string {
    return str.replace(htmlEscapeRe, (ch) => htmlEscapeMap[ch]);
}
export function isEmpty(value: any): boolean {
    if (value == null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}

export function isObject(value: any): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function hasProperty(obj: any, prop: string): boolean {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, prop);
}
export function hasMethod(obj: any, method: string): boolean {
    return obj != null && typeof obj[method] === 'function';
}
export function hasAnyProperty(obj: any, props: string[]): boolean {
    return obj != null && props.some(prop => Object.prototype.hasOwnProperty.call(obj, prop));
}
export function hasData(value: any): boolean {
    return isObject(value) && Object.keys(value).length > 0;
}
export function isArray(value: any): boolean {
    return Array.isArray(value);
}

export function isString(value: any): boolean {
    return typeof value === 'string';
}

export function isNumber(value: any): boolean {
    return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: any): boolean {
    return typeof value === 'boolean';
}

export function isFunction(value: any): boolean {
    return typeof value === 'function';
}

export function isPromise(value: any): boolean {
    return value instanceof Promise || (value !== null && typeof value === 'object' && typeof value.then === 'function');
}

export function isHTMLElement(value: any): boolean {
    return value instanceof HTMLElement;
}

export function isNode(value: any): boolean {
    return value instanceof Node;
}

export function isCommentNode(value: any): boolean {
    return value instanceof Comment;
}

export function isTextNode(value: any): boolean {
    return value instanceof Text;
}

export function isSaoElement(value: any): boolean {
    return value && typeof value === 'object' && 'isSaoElement' in value && value.isSaoElement === true;
}

export function isOneHtml(value: any): boolean {
    return value && typeof value === 'object' && 'isOneHtml' in value && value.isOneHtml === true;
}

export function isOneText(value: any): boolean {
    return value && typeof value === 'object' && 'isOneText' in value && value.isOneText === true;
}

export function isOneNativeElement(value: any): boolean {
    return value && typeof value === 'object' && 'isOneNativeElement' in value && value.isOneNativeElement === true;
}

export function isOneReactive(value: any): boolean {
    return value && typeof value === 'object' && 'isOneReactive' in value && value.isOneReactive === true;
}

export function isSaoFragment(value: any): boolean {
    return value && typeof value === 'object' && 'isSaoFragment' in value && value.isSaoFragment === true;
}

export function isOneBlock(value: any): boolean {
    return value && typeof value === 'object' && 'isOneBlock' in value && value.isOneBlock === true;
}
