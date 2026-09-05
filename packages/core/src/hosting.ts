/**
 * Hosting-provider seam. The free tier ships three providers (`local`,
 * `url-prefix`, `r2`); anything else plugs in through `registerHostingProvider`.
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
  /** `true` when `hosting.base` is required; `parseConfig` rejects a config without one. */
  requiresBase?: boolean;
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

/**
 * Percent-encode every segment of a project-relative file path, keeping `/` as
 * the separator: `build/media/Clip #2 720.mp4` →
 * `build/media/Clip%20%232%20720.mp4`.
 *
 * Media files are named by whatever the maintainer's camera or editor wrote, so
 * a space, a `#` or a `?` in a basename is ordinary. Emitted verbatim into a
 * `src`/`href` a `#` truncates the URL at the fragment and a `?` starts a query
 * string, so the host is asked for the wrong object; encoded, the object key on
 * the bucket (or the path on the origin) is unchanged, because uploads keep the
 * on-disk name and every HTTP server decodes before looking it up.
 */
function encodePathSegments(pathname: string): string {
  return pathname.split('/').map(encodeURIComponent).join('/');
}

/**
 * `config.base` and `file` joined with exactly one slash between them, with
 * `file`'s own segments percent-encoded. `base` is an absolute URL the
 * maintainer authored and is passed through exactly as written.
 */
function joinBase(file: string, config: HostingConfig): string {
  const base = typeof config.base === 'string' ? config.base : '';
  return `${base.replace(/\/+$/, '')}/${encodePathSegments(file.replace(/^\/+/, ''))}`;
}

export const urlPrefixProvider: HostingProvider = {
  name: 'url-prefix',
  requiresBase: true,
  resolve: joinBase,
};

/**
 * Cloudflare R2 behind a public bucket domain. Resolution is the same join as
 * `url-prefix`; the name exists so a config says where the bytes live.
 */
export const r2Provider: HostingProvider = {
  name: 'r2',
  requiresBase: true,
  resolve: joinBase,
};

export const BUILTIN_HOSTING_PROVIDERS: readonly HostingProvider[] = [localProvider, urlPrefixProvider, r2Provider];

/** A fresh registry pre-loaded with the built-in providers. */
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
  const provider: HostingProvider = { name, requiresBase: impl.requiresBase === true, resolve: impl.resolve.bind(impl) };
  registry.providers.set(name, provider);
  return provider;
}

/** Restores the default registry to exactly the built-ins (test isolation). */
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
