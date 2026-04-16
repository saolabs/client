/**
 * OneView Plugins
 * Extension system for OneView framework
 */
export interface PluginOptions {
    [key: string]: unknown;
}
export interface Plugin {
    name: string;
    install(options?: PluginOptions): void;
}
declare class PluginManager {
    private plugins;
    private installed;
    /**
     * Register a plugin
     */
    register(plugin: Plugin): this;
    /**
     * Install a registered plugin
     */
    install(name: string, options?: PluginOptions): this;
    /**
     * Check if a plugin is installed
     */
    isInstalled(name: string): boolean;
    /**
     * Get all registered plugins
     */
    getPlugins(): Plugin[];
}
export declare const pluginManager: PluginManager;
/**
 * Create a plugin
 */
export declare function createPlugin(name: string, install: (options?: PluginOptions) => void): Plugin;
export default pluginManager;
//# sourceMappingURL=plugins.d.ts.map