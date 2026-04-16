import type { ServiceProviderInterface } from "../../contracts/ServiceProviderInterface";

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
} as const;

export type ProviderName = typeof PROVIDER_NAMES[keyof typeof PROVIDER_NAMES];

export type NamedServiceProvider = ServiceProviderInterface & {
    name: string;
    dependsOn?: string[];
};

export function resolveProviderOrder(providers: ServiceProviderInterface[]): ServiceProviderInterface[] {
    const providerMap = new Map<string, ServiceProviderInterface>();
    for (const provider of providers) {
        if (!provider.name) {
            throw new Error(`[Bootstrap] Provider name is required.`);
        }
        if (providerMap.has(provider.name)) {
            throw new Error(`[Bootstrap] Duplicate provider name detected: "${provider.name}".`);
        }
        providerMap.set(provider.name, provider);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const ordered: ServiceProviderInterface[] = [];

    const visit = (name: string): void => {
        if (visited.has(name)) return;
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
