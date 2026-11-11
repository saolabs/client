/** Chạy `run` trong lúc `root` (đã rời DOM) đang bị dọn. */
export declare function discarding(root: Node, run: () => void): void;
/** `node` nằm trong nhánh đang bị vứt bỏ — khỏi cần gỡ riêng. */
export declare function isDiscarded(node: Node | null | undefined): boolean;
//# sourceMappingURL=teardown.d.ts.map