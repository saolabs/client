"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockOutlet = void 0;
const common_1 = require("../contracts/common");
const utils_1 = require("../helpers/utils");
const MarkerModel_1 = require("../services/MarkerModel");
const MarkerRegistry_1 = __importDefault(require("../services/MarkerRegistry"));
const MarkerService_1 = require("../services/MarkerService");
class BlockOutlet {
    constructor({ ctx, parentElement = null, name, id = null, initMode = common_1.InitModes.CREATE }) {
        this.saoType = 'BlockOutlet';
        this.parent = null;
        this.parentElement = null;
        this.initMode = common_1.InitModes.CREATE;
        this.marker = null;
        /** Registry guard */
        this.__destroyed__ = false;
        this.id = id ?? (0, utils_1.generateUUID)(10); // Unique ID for debugging
        this.ctx = ctx;
        this.name = name;
        this.parent = parentElement;
        this.parentElement = parentElement;
        this.initMode = initMode;
        if (this.initMode === common_1.InitModes.HYDRATE) {
            let marker = MarkerService_1.SaoMarker.first('blockoutlet', this.id);
            if (marker) {
                this.marker = marker;
                this.openTag = marker.openTag;
                this.closeTag = marker.closeTag;
            }
            else {
                this.openTag = MarkerRegistry_1.default.createMarkerStart('blockoutlet', this.id);
                this.closeTag = MarkerRegistry_1.default.createMarkerEnd('blockoutlet', this.id);
                MarkerRegistry_1.default.register('blockoutlet', this.id, { name, viewId: ctx.viewId }); // Register this outlet in the MarkerRegistry
                this.marker = new MarkerModel_1.MarkerModel({
                    tagName: "s:bo",
                    name: "blockoutlet",
                    markerID: this.id,
                    openTag: this.openTag,
                    closeTag: this.closeTag,
                    children: [],
                    attributes: {}
                });
            }
        }
        else {
            this.openTag = MarkerRegistry_1.default.createMarkerStart('blockoutlet', this.id);
            this.closeTag = MarkerRegistry_1.default.createMarkerEnd('blockoutlet', this.id);
            MarkerRegistry_1.default.register('blockoutlet', this.id, { name, viewId: ctx.viewId }); // Register this outlet in the MarkerRegistry
            this.marker = new MarkerModel_1.MarkerModel({
                tagName: "s:bo",
                name: "blockoutlet",
                markerID: this.id,
                openTag: this.openTag,
                closeTag: this.closeTag,
                children: [],
                attributes: {}
            });
        }
    }
    hydrate() {
        // Hydration logic if needed (e.g. reattach event listeners)
    }
    /** Render — idempotent: markers đã trong DOM thì giữ nguyên (same-layout reuse) */
    render() {
        if (this.__destroyed__)
            return;
        if (this.openTag.parentNode)
            return; // đã đặt — không đặt lại
        if (!this.parentElement || !this.parentElement.element)
            return;
        const parentEl = this.parentElement.element;
        parentEl.appendChild(this.openTag);
        parentEl.appendChild(this.closeTag);
    }
    destroy() {
        this.__destroyed__ = true;
        // Clear nội dung giữa markers (block content nếu còn)
        let current = this.openTag.nextSibling;
        while (current && current !== this.closeTag) {
            const next = current.nextSibling;
            current.remove();
            current = next;
        }
        // Remove markers from DOM
        this.openTag.remove();
        this.closeTag.remove();
    }
    start() {
        // Placeholder for any setup needed when the outlet becomes active
    }
    stop() {
        // Placeholder for any cleanup needed when the outlet becomes inactive
    }
    setParentElement(parentElement) {
        this.parent = parentElement;
        this.parentElement = parentElement;
    }
    get isSaoElement() {
        return true;
    }
    set isSaoElement(value) {
        // No-op setter to satisfy OneElement interface
    }
    get isOneBlockOutlet() {
        return true;
    }
    set isOneBlockOutlet(value) {
        // No-op setter to satisfy the Interface; this property is always true for BlockOutlet elements
    }
}
exports.BlockOutlet = BlockOutlet;
