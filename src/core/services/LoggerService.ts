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

// ─── Types ──────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerConfig {
    /** Minimum log level to output (default: 'info') */
    level?: LogLevel;
    /** Enable/disable console output (default: true) */
    enabled?: boolean;
    /** Prefix for all log messages (default: '') */
    prefix?: string;
    /** Max history entries (0 = unlimited, default: 500) */
    maxHistory?: number;
}

interface LogEntry {
    level: LogLevel;
    timestamp: number;
    args: any[];
}

// ─── Log Level Priority ─────────────────────────────────────────

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
};

// ─── LoggerService ──────────────────────────────────────────────

export class LoggerService {
    private config: Required<LoggerConfig>;
    private history: LogEntry[] = [];

    constructor(config: LoggerConfig = {}) {
        this.config = {
            level: config.level ?? 'info',
            enabled: config.enabled ?? true,
            prefix: config.prefix ?? '',
            maxHistory: config.maxHistory ?? 500,
        };
    }

    // ─── Config ─────────────────────────────────────────────────

    setConfig(config: Partial<LoggerConfig>): void {
        Object.assign(this.config, config);
    }

    getConfig(): Readonly<Required<LoggerConfig>> {
        return this.config;
    }

    enable(): void { this.config.enabled = true; }
    disable(): void { this.config.enabled = false; }

    setLevel(level: LogLevel): void { this.config.level = level; }
    setPrefix(prefix: string): void { this.config.prefix = prefix; }

    // ─── Log Methods ────────────────────────────────────────────

    debug(...args: any[]): void { this.write('debug', args); }
    info(...args: any[]): void { this.write('info', args); }
    log(...args: any[]): void { this.write('info', args); }
    warn(...args: any[]): void { this.write('warn', args); }
    error(...args: any[]): void { this.write('error', args); }

    // ─── History ────────────────────────────────────────────────

    /** Get all stored log entries */
    getHistory(): readonly LogEntry[] {
        return this.history;
    }

    /** Get history filtered by level */
    getHistoryByLevel(level: LogLevel): LogEntry[] {
        return this.history.filter((e) => e.level === level);
    }

    /** Clear log history */
    clearHistory(): void {
        this.history = [];
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    destroy(): void {
        this.history = [];
    }

    // ─── Private ────────────────────────────────────────────────

    private write(level: LogLevel, args: any[]): void {
        // Always store in history
        this.addToHistory(level, args);

        // Check if should output to console
        if (!this.config.enabled) return;
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.config.level]) return;

        const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
        const method = level === 'debug' ? 'debug' : level === 'info' ? 'log' : level;

        if (prefix) {
            (console as any)[method](prefix, ...args);
        } else {
            (console as any)[method](...args);
        }
    }

    private addToHistory(level: LogLevel, args: any[]): void {
        this.history.push({ level, timestamp: Date.now(), args });

        // Trim if over max
        if (this.config.maxHistory > 0 && this.history.length > this.config.maxHistory) {
            this.history = this.history.slice(-this.config.maxHistory);
        }
    }
}


export const logger = new LoggerService();
export default logger;