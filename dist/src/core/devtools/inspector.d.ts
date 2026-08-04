declare class Inspector {
    private panel;
    private unsubscribe;
    private refreshQueued;
    private selectedViewId;
    isOpen(): boolean;
    open(): void;
    close(): void;
    toggle(): void;
    private queueRefresh;
    private buildPanel;
    private button;
    private section;
    private refresh;
    private muted;
    private renderNode;
    private renderEvent;
    private describe;
    /**
     * View không có 1 element bọc ngoài (kiến trúc marker, no-VDOM) → lấy
     * bounding box của TẤT CẢ node giữa cặp marker `<!--s:v:{viewId}-s/-e-->`.
     */
    private highlight;
    private rangeOfView;
    private clearHighlight;
}
export declare const inspector: Inspector;
/** Ctrl+Shift+D bật/tắt panel — chỉ gắn khi devtools đã enable. */
export declare function bindDevtoolsShortcut(): void;
export default inspector;
//# sourceMappingURL=inspector.d.ts.map