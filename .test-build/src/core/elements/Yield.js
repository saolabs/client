"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YieldElement = void 0;
const common_1 = require("../contracts/common");
const utils_1 = require("../helpers/utils");
const MarkerService_1 = require("../services/MarkerService");
class YieldElement {
    constructor({ ctx, name = '', initMode = common_1.InitModes.CREATE, id = null, defaultValue = '' }) {
        this.saoType = "Yield";
        this.contentFactory = () => [];
        this.initMode = common_1.InitModes.CREATE;
        this.domChildren = [];
        this.parent = null;
        this.defaultValue = '';
        this.ctx = ctx;
        this.name = name;
        this.initMode = initMode;
        this.id = id && id.length > 0 ? id : (0, utils_1.generateUUID)();
        this.defaultValue = defaultValue;
        const yeildMarker = (this.initMode === common_1.InitModes.HYDRATE) ? MarkerService_1.SaoMarker.first('yield', this.id) : null;
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
        const key = MarkerService_1.SaoMarker.addRegistry('yield', this.id, { name: this.name });
        this.openTag = MarkerService_1.SaoMarker.createOpenMarker('yield', this.id);
        this.closeTag = MarkerService_1.SaoMarker.createCloseMarker('yield', this.id);
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
    get isSaoElement() { return true; }
    set isSaoElement(_) { }
    get isOneYield() { return true; }
    set isOneYield(_) { }
}
exports.YieldElement = YieldElement;
