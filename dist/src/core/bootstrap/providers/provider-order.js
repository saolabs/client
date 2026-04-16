/**
 * Tên các provider mặc định — dùng constant thay vì magic string.
 * Custom providers có thể dùng tên khác hoặc override tên mặc định.
 */
export const PROVIDER_NAMES = {
    CORE: 'core',
    VIEW: 'view',
    ROUTER: 'router',
    HELPER: 'helper',
    API: 'api',
};
export function resolveProviderOrder(providers) {
    const providerMap = new Map();
    for (const provider of providers) {
        if (!provider.name) {
            throw new Error(`[Bootstrap] Provider name is required.`);
        }
        if (providerMap.has(provider.name)) {
            throw new Error(`[Bootstrap] Duplicate provider name detected: "${provider.name}".`);
        }
        providerMap.set(provider.name, provider);
    }
    const visited = new Set();
    const inStack = new Set();
    const ordered = [];
    const visit = (name) => {
        if (visited.has(name))
            return;
        if (inStack.has(name)) {
            throw new Error(`[Bootstrap] Circular service provider dependency detected at "${name}".`);
        }
        const provider = providerMap.get(name);
        if (!provider) {
            throw new Error(`[Bootstrap] Missing provider dependency: "${name}".`);
        }
        inStack.add(name);
        for (const dep of provider.dependsOn ?? []) {
            visit(dep);
        }
        inStack.delete(name);
        visited.add(name);
        ordered.push(provider);
    };
    for (const provider of providers) {
        if (provider.name) {
            visit(provider.name);
        }
    }
    return ordered;
}
//# sourceMappingURL=provider-order.js.map