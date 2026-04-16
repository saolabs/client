import { app } from "../hellpers/app";
export class DomService {
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
export const Dom = app(DomService);
export default Dom;
//# sourceMappingURL=DomService.js.map