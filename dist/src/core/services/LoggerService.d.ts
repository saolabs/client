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
export declare class LoggerService {
    private config;
    private history;
    constructor(config?: LoggerConfig);
    setConfig(config: Partial<LoggerConfig>): void;
    getConfig(): Readonly<Required<LoggerConfig>>;
    enable(): void;
    disable(): void;
    setLevel(level: LogLevel): void;
    setPrefix(prefix: string): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    /** Get all stored log entries */
    getHistory(): readonly LogEntry[];
    /** Get history filtered by level */
    getHistoryByLevel(level: LogLevel): LogEntry[];
    /** Clear log history */
    clearHistory(): void;
    destroy(): void;
    private write;
    private addToHistory;
}
export declare const logger: LoggerService;
export default logger;
//# sourceMappingURL=LoggerService.d.ts.map