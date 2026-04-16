export type InitMode = 'create' | 'hydrate';
export enum InitModes {
    CREATE = 'create',
    HYDRATE = 'hydrate'
}
/**
 * Common types and utilities for OneView contracts
 * This file defines shared types and enums used across OneView's contracts, such as initialization modes and system keys for HTML elements.
 * 
 * Key exports:
 */
/**
 * System keys for HTML elements used by OneView.
 * These keys are used to store metadata on HTML elements, such as IDs and view information.
 * @name ESK (Element System Keys)
 * @enum {string}
 * @property {string} ID - Key for unique element ID
 * @property {string} VIEW_ID - Key for associated view ID
 * @property {string} BLOCK_NAME - Key for block name in block outlets
 * @property {string} BLOCKOUTLET_NAME - Key for block outlet name
 */
export enum ESK {
    ID = 'data-one-id',
    VIEW_ID = 'data-one-view-id',
    BLOCK_NAME = 'data-one-block-name',
    BLOCKOUTLET_NAME = 'data-one-blockoutlet-name'
}