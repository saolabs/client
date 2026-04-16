import { InitModes } from "../contracts/common";
import { generateUUID } from "../hellpers/utils";
import { OneMarker } from "../services/MarkerService";
export class YieldElement {
    constructor({ ctx, name = '', initMode = InitModes.CREATE, id = null, defaultValue = '' }) {
        this.oneType = "Yield";
        this.contentFactory = () => [];
        this.initMode = InitModes.CREATE;
        this.domChildren = [];
        this.parent = null;
        this.defaultValue = '';
        this.ctx = ctx;
        this.name = name;
        this.initMode = initMode;
        this.id = id && id.length > 0 ? id : generateUUID();
        this.defaultValue = defaultValue;
        const yeildMarker = (this.initMode === InitModes.HYDRATE) ? OneMarker.first('yield', this.id) : null;
        if (yeildMarker) {
            this.openTag = yeildMarker.openTag;
            this.closeTag = yeildMarker.closeTag;
            this.domChildren = yeildMarker.nodes.map((el) => el);
        }
        else {
            this.createMarkers();
        }
    }
    createMarkers() {
        const key = OneMarker.addRegistry('yield', this.id, { name: this.name });
        this.openTag = OneMarker.createOpenMarker('yield', this.id);
        this.closeTag = OneMarker.createCloseMarker('yield', this.id);
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    setContentFactory(factory) {
        this.contentFactory = factory;
    }
    render() {
        if (!this.parent?.element)
            return;
        const parentEl = this.parent.element;
        parentEl.appendChild(this.openTag);
        parentEl.appendChild(this.closeTag);
    }
    destroy() {
        this.openTag?.remove();
        this.closeTag?.remove();
        this.domChildren = [];
        this.parent = null;
    }
    get isOneElement() { return true; }
    set isOneElement(_) { }
    get isOneYield() { return true; }
    set isOneYield(_) { }
}
//# sourceMappingURL=Yield.js.map