"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dom = exports.DomService = void 0;
const app_1 = require("../helpers/app");
class DomService {
    constructor() {
        this.container = document.createElement('template');
    }
    parse(html) {
        this.container.innerHTML = html;
        const content = this.container.content;
        this.container.innerHTML = ''; // Clear template content to free memory
        return Array.from(content.childNodes);
    }
    create(tagName, options) {
        return document.createElement(tagName, options);
    }
}
exports.DomService = DomService;
exports.Dom = (0, app_1.app)(DomService);
exports.default = exports.Dom;
