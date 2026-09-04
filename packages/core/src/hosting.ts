/**
 * Hosting-provider seam. The free tier ships two providers (`local`,
 * `url-prefix`); anything else plugs in through `registerHostingProvider`.
 * No paid code lives here.
 */

/** The `hosting` block of `docsandeye.config.yaml`: a provider name plus provider-specific keys. */
export interface HostingConfig {
  provider: string;
  base?: string;
  [key: string]: unknown;
}

export interface HostingProvider {
  name: string;
  /** Map a project-relative media file path to the URL the site should use. */
  resolve(file: string, config: HostingConfig): string;
}

export interface HostingRegistry {
  readonly providers: Map<string, HostingProvider>;
  has(name: string): boolean;
  get(name: string): HostingProvider | undefined;
  names(): string[];
}

class Registry implements HostingRegistry {
  readonly providers = new Map<string, HostingProvider>();
  has(name: string): boolean {
    return this.providers.has(name);
  }
  get(name: string): HostingProvider | undefined {
    return this.providers.get(name);
  }
  names(): string[] {
    return [...this.providers.keys()].sort();
  }
}

export const localProvider: HostingProvider = {
  name: 'local',
  resolve(file) {
    return file;
  },
};

export const urlPrefixProvider: HostingProvider = {
  name: 'url-prefix',
  resolve(file, config) {
    const base = typeof config.base === 'string' ? config.base : '';
    return `${base.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`;
  },
};

export const BUILTIN_HOSTING_PROVIDERS: readonly HostingProvider[] = [localProvider, urlPrefixProvider];

/** A fresh registry pre-loaded with the two built-in providers. */
export function createHostingRegistry(): HostingRegistry {
  const registry = new Registry();
  for (const provider of BUILTIN_HOSTING_PROVIDERS) registry.providers.set(provider.name, provider);
  return registry;
}

/** The process-wide default registry used when no explicit registry is passed. */
export const defaultHostingRegistry: HostingRegistry = createHostingRegistry();

export function registerHostingProvider(
  name: string,
  impl: Omit<HostingProvider, 'name'> & { name?: string },
  registry: HostingRegistry = defaultHostingRegistry,
): HostingProvider {
  if (!name) throw new TypeError('hosting provider name must be a non-empty string');
  if (typeof impl?.resolve !== 'function') throw new TypeError(`hosting provider "${name}" must implement resolve(file, config)`);
  const provider: HostingProvider = { name, resolve: impl.resolve.bind(impl) };
  registry.providers.set(name, provider);
  return provider;
}

/** Restores the default registry to exactly the two built-ins (test isolation). */
export function resetHostingRegistry(registry: HostingRegistry = defaultHostingRegistry): void {
  registry.providers.clear();
  for (const provider of BUILTIN_HOSTING_PROVIDERS) registry.providers.set(provider.name, provider);
}

/** Resolve a media file path through the provider named by `hosting.provider`. */
export function resolveMediaUrl(
  hosting: HostingConfig,
  file: string,
  registry: HostingRegistry = defaultHostingRegistry,
): string {
  const provider = registry.get(hosting.provider);
  if (!provider) {
    throw new Error(`unknown hosting provider "${hosting.provider}" (registered: ${registry.names().join(', ')})`);
  }
  return provider.resolve(file, hosting);
}
