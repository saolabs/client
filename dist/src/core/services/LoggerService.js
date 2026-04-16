/**
 * LoggerService — Configurable console logger with log history.
 *
 * Features:
 *   - Log levels: debug < info < warn < error
 *   - Enable/disable toggle
 *   - Stored log history (for debug tools, remote reporting)
 *   - Prefix formatting
 *
 * Register via DI:
 *   app.singleton('logger', () => new LoggerService({ level: 'info', enabled: true }));
 */
// ─── Log Level Priority ─────────────────────────────────────────
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
};
// ─── LoggerService ──────────────────────────────────────────────
export class LoggerService {
    constructor(config = {}) {
        this.history = [];
        this.config = {
            level: config.level ?? 'info',
            enabled: config.enabled ?? true,
            prefix: config.prefix ?? '',
            maxHistory: config.maxHistory ?? 500,
        };
    }
    // ─── Config ─────────────────────────────────────────────────
    setConfig(config) {
        Object.assign(this.config, config);
    }
    getConfig() {
        return this.config;
    }
    enable() { this.config.enabled = true; }
    disable() { this.config.enabled = false; }
    setLevel(level) { this.config.level = level; }
    setPrefix(prefix) { this.config.prefix = prefix; }
    // ─── Log Methods ────────────────────────────────────────────
    debug(...args) { this.write('debug', args); }
    info(...args) { this.write('info', args); }
    log(...args) { this.write('info', args); }
    warn(...args) { this.write('warn', args); }
    error(...args) { this.write('error', args); }
    // ─── History ────────────────────────────────────────────────
    /** Get all stored log entries */
    getHistory() {
        return this.history;
    }
    /** Get history filtered by level */
    getHistoryByLevel(level) {
        return this.history.filter((e) => e.level === level);
    }
    /** Clear log history */
    clearHistory() {
        this.history = [];
    }
    // ─── Lifecycle ──────────────────────────────────────────────
    destroy() {
        this.history = [];
    }
    // ─── Private ────────────────────────────────────────────────
    write(level, args) {
        // Always store in history
        this.addToHistory(level, args);
        // Check if should output to console
        if (!this.config.enabled)
            return;
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.level])
            return;
        const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
        const method = level === 'debug' ? 'debug' : level === 'info' ? 'log' : level;
        if (prefix) {
            console[method](prefix, ...args);
        }
        else {
            console[method](...args);
        }
    }
    addToHistory(level, args) {
        this.history.push({ level, timestamp: Date.now(), args });
        // Trim if over max
        if (this.config.maxHistory > 0 && this.history.length > this.config.maxHistory) {
            this.history = this.history.slice(-this.config.maxHistory);
        }
    }
}
export const logger = new LoggerService();
export default logger;
//# sourceMappingURL=LoggerService.js.map