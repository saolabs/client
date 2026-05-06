import { InitMode, InitModes } from "../contracts/common";
import { HtmlInterface, OneChildrenFactoryOutput, YieldInterface } from "../contracts/ElementInterface";
import { ViewControllerInterface } from "../contracts/ViewControllerInterface";
import { generateUUID } from "../helpers/utils";
import { MarkerModel, OneMarker } from "../services/MarkerService";
import { OneObjectType } from "../types/utils";

export class YieldElement implements YieldInterface{
    oneType: OneObjectType = "Yield";
    ctx: ViewControllerInterface;
    name: string
    id: string;
    contentFactory: () => OneChildrenFactoryOutput = () => [];
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
        
        const yeildMarker: MarkerModel | null = (this.initMode === InitModes.HYDRATE) ? OneMarker.first('yield', this.id) : null;
        if(yeildMarker){
            this.openTag = yeildMarker.openTag;
            this.closeTag = yeildMarker.closeTag;
            this.domChildren = yeildMarker.nodes.map((el: Node) => el);
        } else {
            this.createMarkers();
        }
        
    }
    private createMarkers(){
        const key = OneMarker.addRegistry('yield', this.id, {name: this.name});
        this.openTag = OneMarker.createOpenMarker('yield', this.id);
        this.closeTag = OneMarker.createCloseMarker('yield', this.id);
    }

    setParentElement(parent: HtmlInterface | null): void {
        this.parent = parent;
    }

    setContentFactory(factory: () => OneChildrenFactoryOutput): void {
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

    get isOneElement(): boolean { return true; }
    set isOneElement(_: boolean) {}
    get isOneYield(): boolean { return true; }
    set isOneYield(_: boolean) {}
}