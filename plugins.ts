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

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private installed: Set<string> = new Set();

  /**
   * Register a plugin
   */
  register(plugin: Plugin): this {
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
  install(name: string, options?: PluginOptions): this {
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
  isInstalled(name: string): boolean {
    return this.installed.has(name);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginManager = new PluginManager();

/**
 * Create a plugin
 */
export function createPlugin(name: string, install: (options?: PluginOptions) => void): Plugin {
  return {
    name,
    install
  };
}

export default pluginManager;
