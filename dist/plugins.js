/**
 * OneView Plugins
 * Extension system for OneView framework
 */
class PluginManager {
    constructor() {
        this.plugins = new Map();
        this.installed = new Set();
    }
    /**
     * Register a plugin
     */
    register(plugin) {
        if (this.plugins.has(plugin.name)) {
            console.warn(`Plugin "${plugin.name}" is already registered`);
            return this;
        }
        this.plugins.set(plugin.name, plugin);
        return this;
    }
    /**
     * Install a registered plugin
     */
    install(name, options) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin "${name}" is not registered`);
        }
        if (this.installed.has(name)) {
            console.warn(`Plugin "${name}" is already installed`);
            return this;
        }
        plugin.install(options);
        this.installed.add(name);
        return this;
    }
    /**
     * Check if a plugin is installed
     */
    isInstalled(name) {
        return this.installed.has(name);
    }
    /**
     * Get all registered plugins
     */
    getPlugins() {
        return Array.from(this.plugins.values());
    }
}
export const pluginManager = new PluginManager();
/**
 * Create a plugin
 */
export function createPlugin(name, install) {
    return {
        name,
        install
    };
}
export default pluginManager;
//# sourceMappingURL=plugins.js.map