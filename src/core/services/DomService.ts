import { app } from "../helpers/app.js";


export class DomService {
    private container: HTMLTemplateElement;
    constructor() {
        this.container = document.createElement('template');
    }
    
    parse(html: string): Node[]{
        this.container.innerHTML = html;
        const nodes = Array.from(this.container.content.childNodes);
        this.container.innerHTML = ''; // Clear template content to free memory
        return nodes;
    }
    create(tagName: string, options?: ElementCreationOptions): HTMLElement {
        return document.createElement(tagName, options);
    }


}



export const Dom = app(DomService);
export default Dom;
