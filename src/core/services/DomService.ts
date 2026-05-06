import { app } from "../helpers/app";


export class DomService {
    private container: HTMLTemplateElement;
    constructor() {
        this.container = document.createElement('template');
    }
    
    parse(html: string): Node[]{
        this.container.innerHTML = html;
        const content = this.container.content;
        this.container.innerHTML = ''; // Clear template content to free memory
        return Array.from(content.childNodes);
    }
    create(tagName: string, options?: ElementCreationOptions): HTMLElement {
        return document.createElement(tagName, options);
    }


}



export const Dom = app(DomService);
export default Dom;
