/**
 * DevTools inspector — panel in-page, không cần cài extension.
 *
 * Vì sao overlay chứ không phải browser extension: extension cần scaffolding
 * riêng (manifest, content script, bridge, publish store) mà vẫn hiển thị đúng
 * dữ liệu này. Overlay chạy ngay ở mọi môi trường (kể cả máy khác, mobile
 * webview) với chi phí nhỏ hơn nhiều. Hook (`devtools/hook.ts`) đã tách riêng
 * nên extension vẫn dựng được sau này trên CÙNG nguồn dữ liệu.
 *
 * Bật:  App.devtools.open()   — hoặc Ctrl+Shift+D sau khi App.devtools.enable()
 *
 * Toàn bộ DOM của panel dựng bằng createElement + textContent — panel hiển thị
 * state/đường dẫn/thông báo lỗi do người dùng kiểm soát, nội suy chuỗi vào
 * innerHTML ở đây là đường tiêm HTML (đúng lỗi đã vá ở GAP-07).
 */
import devtools, { DevtoolsEvent, DevtoolsViewNode } from './hook';

const PANEL_ID = '__saola_devtools_panel__';
const HIGHLIGHT_ID = '__saola_devtools_highlight__';

class Inspector {
    private panel: HTMLElement | null = null;
    private unsubscribe: (() => void) | null = null;
    private refreshQueued = false;
    private selectedViewId: string | null = null;

    isOpen(): boolean { return this.panel !== null; }

    open(): void {
        if (this.panel || typeof document === 'undefined') return;
        devtools.enable();

        this.panel = this.buildPanel();
        document.body.appendChild(this.panel);

        // Gom nhiều sự kiện trong cùng frame thành 1 lần vẽ — state đổi có thể
        // bắn hàng loạt, vẽ lại từng cái sẽ tự làm chậm chính app đang debug.
        this.unsubscribe = devtools.subscribe(() => this.queueRefresh());
        this.refresh();
    }

    close(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.panel?.remove();
        this.panel = null;
        this.clearHighlight();
    }

    toggle(): void { this.isOpen() ? this.close() : this.open(); }

    private queueRefresh(): void {
        if (this.refreshQueued) return;
        this.refreshQueued = true;
        requestAnimationFrame(() => { this.refreshQueued = false; this.refresh(); });
    }

    // ── Dựng khung ────────────────────────────────────────────────

    private buildPanel(): HTMLElement {
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = [
            'position:fixed', 'right:12px', 'bottom:12px', 'width:380px', 'max-height:70vh',
            'z-index:2147483647', 'display:flex', 'flex-direction:column',
            'background:#1e1e2e', 'color:#cdd6f4', 'border:1px solid #45475a', 'border-radius:8px',
            'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
            'box-shadow:0 8px 32px rgba(0,0,0,.4)', 'overflow:hidden',
        ].join(';');

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:#181825;border-bottom:1px solid #45475a';
        const title = document.createElement('strong');
        title.textContent = 'Saola DevTools';
        title.style.cssText = 'flex:1;color:#89b4fa';
        const btnClear = this.button('Xoá log', () => { devtools.clearLog(); this.refresh(); });
        const btnClose = this.button('✕', () => this.close());
        header.append(title, btnClear, btnClose);

        const body = document.createElement('div');
        body.setAttribute('data-role', 'body');
        body.style.cssText = 'overflow:auto;padding:8px 10px';

        panel.append(header, body);
        return panel;
    }

    private button(label: string, onClick: () => void): HTMLButtonElement {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'background:#313244;color:#cdd6f4;border:1px solid #45475a;border-radius:4px;padding:2px 8px;cursor:pointer;font:inherit';
        b.addEventListener('click', onClick);
        return b;
    }

    private section(label: string): HTMLElement {
        const h = document.createElement('div');
        h.textContent = label;
        h.style.cssText = 'margin:10px 0 4px;color:#a6adc8;text-transform:uppercase;font-size:10px;letter-spacing:.08em';
        return h;
    }

    // ── Vẽ nội dung ───────────────────────────────────────────────

    private refresh(): void {
        const body = this.panel?.querySelector('[data-role="body"]') as HTMLElement | null;
        if (!body) return;
        body.replaceChildren();

        const tree = devtools.getViewTree();
        body.append(this.section(`Cây view (${tree.length} gốc)`));
        if (tree.length === 0) {
            body.append(this.muted('Chưa có view nào mount.'));
        } else {
            for (const node of tree) body.append(this.renderNode(node, 0));
        }

        const log = devtools.getLog().slice(-25).reverse();
        body.append(this.section(`Sự kiện gần đây (${log.length})`));
        if (log.length === 0) body.append(this.muted('Chưa có sự kiện.'));
        else for (const e of log) body.append(this.renderEvent(e));
    }

    private muted(text: string): HTMLElement {
        const d = document.createElement('div');
        d.textContent = text;
        d.style.cssText = 'color:#6c7086;padding:2px 0';
        return d;
    }

    private renderNode(node: DevtoolsViewNode, depth: number): HTMLElement {
        const wrap = document.createElement('div');
        wrap.style.cssText = `margin-left:${depth * 12}px`;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:baseline;padding:2px 4px;border-radius:4px;cursor:pointer';
        row.addEventListener('mouseenter', () => this.highlight(node.viewId));
        row.addEventListener('mouseleave', () => this.clearHighlight());
        row.addEventListener('click', () => {
            this.selectedViewId = this.selectedViewId === node.viewId ? null : node.viewId;
            this.refresh();
        });

        const path = document.createElement('span');
        path.textContent = node.path || '(không tên)';
        path.style.cssText = 'color:#a6e3a1;flex:1';

        const meta = document.createElement('span');
        meta.textContent = `${node.viewType} · ${node.lifecycleState} · ${node.elementCount}el`;
        meta.style.cssText = `color:${node.lifecycleState === 'active' ? '#6c7086' : '#f9e2af'};font-size:10px`;

        row.append(path, meta);
        wrap.append(row);

        // Bấm để mở/đóng state — mặc định đóng cho gọn khi cây lớn
        if (this.selectedViewId === node.viewId) {
            const keys = Object.keys(node.state);
            if (keys.length === 0) {
                wrap.append(this.muted('  (không có state)'));
            } else {
                for (const key of keys) {
                    const line = document.createElement('div');
                    line.style.cssText = 'display:flex;gap:6px;padding-left:10px';
                    const k = document.createElement('span');
                    k.textContent = key + ':';
                    k.style.cssText = 'color:#f5c2e7';
                    const v = document.createElement('span');
                    // textContent — state có thể chứa chuỗi do người dùng nhập
                    v.textContent = JSON.stringify(node.state[key]) ?? 'undefined';
                    v.style.cssText = 'color:#cdd6f4;word-break:break-all';
                    line.append(k, v);
                    wrap.append(line);
                }
            }
        }

        for (const child of node.children) wrap.append(this.renderNode(child, depth + 1));
        return wrap;
    }

    private renderEvent(e: DevtoolsEvent): HTMLElement {
        const colors: Record<string, string> = {
            'view:mounted': '#a6e3a1', 'view:destroyed': '#f38ba8',
            'state:changed': '#89b4fa', 'error': '#fab387',
        };
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;padding:1px 0';

        const t = document.createElement('span');
        t.textContent = String(e.at).padStart(6, ' ');
        t.style.cssText = 'color:#6c7086;flex-shrink:0';

        const type = document.createElement('span');
        type.textContent = e.type;
        type.style.cssText = `color:${colors[e.type] ?? '#cdd6f4'};flex-shrink:0`;

        const detail = document.createElement('span');
        detail.textContent = this.describe(e);
        detail.style.cssText = 'color:#a6adc8;word-break:break-all';

        row.append(t, type, detail);
        return row;
    }

    private describe(e: DevtoolsEvent): string {
        if (e.type === 'state:changed') return `${e.path ?? ''} [${(e.detail?.keys ?? []).join(', ')}]`;
        if (e.type === 'error') return `${e.detail?.phase ?? ''} ${e.path ?? ''}: ${e.detail?.message ?? ''}`;
        return e.path ?? '';
    }

    // ── Highlight vùng DOM của view theo marker ───────────────────

    /**
     * View không có 1 element bọc ngoài (kiến trúc marker, no-VDOM) → lấy
     * bounding box của TẤT CẢ node giữa cặp marker `<!--s:v:{viewId}-s/-e-->`.
     */
    private highlight(viewId: string): void {
        this.clearHighlight();
        const range = this.rangeOfView(viewId);
        if (!range) return;
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const box = document.createElement('div');
        box.id = HIGHLIGHT_ID;
        box.style.cssText = [
            'position:fixed', `left:${rect.left}px`, `top:${rect.top}px`,
            `width:${rect.width}px`, `height:${rect.height}px`,
            'background:rgba(137,180,250,.25)', 'border:1px solid #89b4fa',
            'pointer-events:none', 'z-index:2147483646',
        ].join(';');
        document.body.appendChild(box);
    }

    private rangeOfView(viewId: string): Range | null {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
        let open: Comment | null = null;
        let node: Comment | null;
        while ((node = walker.nextNode() as Comment | null)) {
            const v = node.nodeValue?.trim() ?? '';
            if (v === `s:v:${viewId}-s`) { open = node; continue; }
            if (open && v === `s:v:${viewId}-e`) {
                const range = document.createRange();
                range.setStartAfter(open);
                range.setEndBefore(node);
                return range;
            }
        }
        return null;
    }

    private clearHighlight(): void {
        document.getElementById(HIGHLIGHT_ID)?.remove();
    }
}

export const inspector = new Inspector();

/** Ctrl+Shift+D bật/tắt panel — chỉ gắn khi devtools đã enable. */
export function bindDevtoolsShortcut(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
            e.preventDefault();
            inspector.toggle();
        }
    });
}

export default inspector;
