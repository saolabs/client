import { InitModes } from "../contracts/common";
import { generateUUID } from "../hellpers/utils";
export class Component {
    constructor({ ctx, parent = null, id = null, stateKeys = [], data = {}, dataFactory = null, path = null, type = 'default', condition = null, initMode = InitModes.CREATE, }) {
        this.oneType = 'Component';
        this.domChildren = []; // For compatibility with HtmlInterface; Component itself doesn't have a single root element
        this.viewRef = null;
        this.path = null; // For dynamic imports
        this.type = 'default';
        this.condition = null; // For 'when' type components
        this.initMode = InitModes.CREATE; // Default initialization mode
        this.subscribeFn = () => { };
        this.unsubscribeFn = () => { };
        this.dataFactory = null;
        this.ctx = ctx;
        this.parent = parent;
        this.stateKeys = stateKeys;
        this.data = data || {};
        this.openTag = document.createComment(`component-start`);
        this.closeTag = document.createComment(`component-end`);
        this.id = `${ctx.viewId}-${id ?? generateUUID(10)}`; // Unique ID for debugging
        this.dataFactory = dataFactory;
        this.path = path;
        this.type = type;
        this.condition = condition;
        this.initMode = initMode ?? InitModes.CREATE;
    }
    mergeData(newData) {
        this.data = { ...this.data, ...newData };
    }
    setDataFactory(factory) {
        this.dataFactory = factory;
    }
    setCondition(condition) {
        this.condition = condition;
    }
    setStateKeys(stateKeys) {
        this.stateKeys = stateKeys;
    }
    setParentElement(parent) {
        this.parent = parent;
    }
    setView(view) {
        this.viewRef = view;
    }
    setParent(parent) {
        this.parent = parent;
    }
    start() {
    }
    stop() {
    }
    render() {
        // To be implemented by specific components
    }
    destroy() {
        // To be implemented by specific components
    }
    get isOneElement() {
        return true;
    }
    set isOneElement(value) {
        // No-op, just for type compatibility
    }
    get isOneComponent() {
        return true;
    }
    set isOneComponent(value) {
        // No-op, just for type compatibility
    }
}
//# sourceMappingURL=Component.js.map