import { InitMode, InitModes } from "../contracts/common";
import { HtmlInterface, SaoChildrenFactoryOutput, YieldInterface } from "../contracts/ElementInterface";
import { MarkerModelInterface } from "../contracts/MarkerInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import { MarkerModel } from "../services/MarkerModel";
import { SaoMarker } from "../services/MarkerService";
import { SaoObjectType } from "../types/utils";

export class YieldElement implements YieldInterface{
    saoType: SaoObjectType = "Yield";
    ctx: ViewControllerInterface;
    name: string
    id: string;
    contentFactory: () => SaoChildrenFactoryOutput = () => [];
    openTag!: Comment;
    closeTag!: Comment;
    initMode: InitMode = InitModes.CREATE
    domChildren: Node[] = [];
    parent: HtmlInterface | null = null;
    defaultValue: string = '';
    constructor({ctx, name = '', initMode = InitModes.CREATE, id = null, defaultValue = ''} : {ctx: ViewControllerInterface, name: string, initMode?: InitMode, id?: string | null, defaultValue?: string}) {
        this.ctx = ctx;
        this.name = name;
        this.initMode = initMode;
        this.id = id && id.length > 0 ? id : generateUUID();
        this.defaultValue = defaultValue;
        
        const yeildMarker: MarkerModelInterface | null = (this.initMode === InitModes.HYDRATE) ? SaoMarker.first('yield', this.id) : null;
        if(yeildMarker){
            this.openTag = yeildMarker.openTag;
            this.closeTag = yeildMarker.closeTag;
            this.domChildren = yeildMarker.nodes.map((el: Node) => el);
        } else {
            this.createMarkers();
        }
        
    }
    private createMarkers(){
        const key = SaoMarker.addRegistry('yield', this.id, {name: this.name});
        this.openTag = SaoMarker.createOpenMarker('yield', this.id);
        this.closeTag = SaoMarker.createCloseMarker('yield', this.id);
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    setContentFactory(factory: () => SaoChildrenFactoryOutput): void {
        this.contentFactory = factory;
    }

    render(): void {
        if (!this.parent?.element) return;

        const parentEl = this.parent.element;
        parentEl.appendChild(this.openTag);
        parentEl.appendChild(this.closeTag);
    }

    destroy(): void {
        this.openTag?.remove();
        this.closeTag?.remove();
        this.domChildren = [];
        this.parent = null;
    }

    get isSaoElement(): boolean { return true; }
    set isSaoElement(_: boolean) {}
    get isOneYield(): boolean { return true; }
    set isOneYield(_: boolean) {}
}