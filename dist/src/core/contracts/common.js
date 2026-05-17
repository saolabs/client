export var InitModes;
(function (InitModes) {
    InitModes["CREATE"] = "create";
    InitModes["HYDRATE"] = "hydrate";
})(InitModes || (InitModes = {}));
/**
 * Common types and utilities for SaoView contracts
 * This file defines shared types and enums used across SaoView's contracts, such as initialization modes and system keys for HTML elements.
 *
 * Key exports:
 */
/**
 * System keys for HTML elements used by SaoView.
 * These keys are used to store metadata on HTML elements, such as IDs and view information.
 * @name ESK (Element System Keys)
 * @enum {string}
 * @property {string} ID - Key for unique element ID
 * @property {string} VIEW_ID - Key for associated view ID
 * @property {string} BLOCK_NAME - Key for block name in block outlets
 * @property {string} BLOCKOUTLET_NAME - Key for block outlet name
 */
export var ESK;
(function (ESK) {
    ESK["ID"] = "data-one-id";
    ESK["VIEW_ID"] = "data-one-view-id";
    ESK["BLOCK_NAME"] = "data-one-block-name";
    ESK["BLOCKOUTLET_NAME"] = "data-one-blockoutlet-name";
})(ESK || (ESK = {}));
//# sourceMappingURL=common.js.map