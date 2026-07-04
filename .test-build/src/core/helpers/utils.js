"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUUID = generateUUID;
exports.escapeHTML = escapeHTML;
exports.isEmpty = isEmpty;
exports.isObject = isObject;
exports.hasProperty = hasProperty;
exports.hasMethod = hasMethod;
exports.hasAnyProperty = hasAnyProperty;
exports.hasData = hasData;
exports.isArray = isArray;
exports.isString = isString;
exports.isNumber = isNumber;
exports.isBoolean = isBoolean;
exports.isFunction = isFunction;
exports.isPromise = isPromise;
exports.isHTMLElement = isHTMLElement;
exports.isNode = isNode;
exports.isCommentNode = isCommentNode;
exports.isTextNode = isTextNode;
exports.isSaoElement = isSaoElement;
exports.isOneHtml = isOneHtml;
exports.isOneText = isOneText;
exports.isOneNativeElement = isOneNativeElement;
exports.isOneReactive = isOneReactive;
exports.isSaoFragment = isSaoFragment;
exports.isOneBlock = isOneBlock;
function generateUUID(length = 36) {
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
function escapeHTML(str) {
    return str.replace(htmlEscapeRe, (ch) => htmlEscapeMap[ch]);
}
function isEmpty(value) {
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
function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hasProperty(obj, prop) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, prop);
}
function hasMethod(obj, method) {
    return obj != null && typeof obj[method] === 'function';
}
function hasAnyProperty(obj, props) {
    return obj != null && props.some(prop => Object.prototype.hasOwnProperty.call(obj, prop));
}
function hasData(value) {
    return isObject(value) && Object.keys(value).length > 0;
}
function isArray(value) {
    return Array.isArray(value);
}
function isString(value) {
    return typeof value === 'string';
}
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}
function isBoolean(value) {
    return typeof value === 'boolean';
}
function isFunction(value) {
    return typeof value === 'function';
}
function isPromise(value) {
    return value instanceof Promise || (value !== null && typeof value === 'object' && typeof value.then === 'function');
}
function isHTMLElement(value) {
    return value instanceof HTMLElement;
}
function isNode(value) {
    return value instanceof Node;
}
function isCommentNode(value) {
    return value instanceof Comment;
}
function isTextNode(value) {
    return value instanceof Text;
}
function isSaoElement(value) {
    return value && typeof value === 'object' && 'isSaoElement' in value && value.isSaoElement === true;
}
function isOneHtml(value) {
    return value && typeof value === 'object' && 'isOneHtml' in value && value.isOneHtml === true;
}
function isOneText(value) {
    return value && typeof value === 'object' && 'isOneText' in value && value.isOneText === true;
}
function isOneNativeElement(value) {
    return value && typeof value === 'object' && 'isOneNativeElement' in value && value.isOneNativeElement === true;
}
function isOneReactive(value) {
    return value && typeof value === 'object' && 'isOneReactive' in value && value.isOneReactive === true;
}
function isSaoFragment(value) {
    return value && typeof value === 'object' && 'isSaoFragment' in value && value.isSaoFragment === true;
}
function isOneBlock(value) {
    return value && typeof value === 'object' && 'isOneBlock' in value && value.isOneBlock === true;
}
