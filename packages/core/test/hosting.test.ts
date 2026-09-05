import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  BUILTIN_HOSTING_PROVIDERS,
  r2Provider,
  resolveMediaUrl,
  createHostingRegistry,
  registerHostingProvider,
  resetHostingRegistry,
  defaultHostingRegistry,
  localProvider,
  urlPrefixProvider,
} from '../src/index.js';

describe('AC11: Hosting seam', () => {
  afterEach(() => {
    resetHostingRegistry();
  });

  it('local provider returns file unchanged', () => {
    const result = resolveMediaUrl({ provider: 'local' }, 'assets/video/test.mp4');
    expect(result).toBe('assets/video/test.mp4');
  });

  it('url-prefix returns base + "/" + file', () => {
    const hosting = {
      provider: 'url-prefix',
      base: 'https://media.example.com'
    };
    const result = resolveMediaUrl(hosting, 'assets/video/test.mp4');
    expect(result).toBe('https://media.example.com/assets/video/test.mp4');
  });

  it('url-prefix removes trailing slashes from base', () => {
    const hosting = {
      provider: 'url-prefix',
      base: 'https://media.example.com/'
    };
    const result = resolveMediaUrl(hosting, 'assets/video/test.mp4');
    expect(result).toBe('https://media.example.com/assets/video/test.mp4');
  });

  it('url-prefix removes leading slashes from file', () => {
    const hosting = {
      provider: 'url-prefix',
      base: 'https://media.example.com'
    };
    const result = resolveMediaUrl(hosting, '/assets/video/test.mp4');
    expect(result).toBe('https://media.example.com/assets/video/test.mp4');
  });

  it('url-prefix handles both trailing and leading slashes', () => {
    const hosting = {
      provider: 'url-prefix',
      base: 'https://media.example.com/'
    };
    const result = resolveMediaUrl(hosting, '/assets/video/test.mp4');
    expect(result).toBe('https://media.example.com/assets/video/test.mp4');
  });

  it('HostingProvider has name and resolve function', () => {
    expect(localProvider).toHaveProperty('name');
    expect(localProvider).toHaveProperty('resolve');
    expect(typeof localProvider.resolve).toBe('function');
  });

  it('registerHostingProvider adds provider to registry', () => {
    const registry = createHostingRegistry();
    registerHostingProvider('custom', { resolve: (f: string) => 'custom:' + f }, registry);
    // Verify it was registered by using it
    const result = resolveMediaUrl({ provider: 'custom' }, 'test.mp4', registry);
    expect(result).toBe('custom:test.mp4');
  });

  it('custom provider in explicit registry does not affect default registry', () => {
    const customRegistry = createHostingRegistry();
    registerHostingProvider('myproto', { resolve: (f: string) => 'myproto:' + f }, customRegistry);

    // Explicit registry has it
    const result1 = resolveMediaUrl({ provider: 'myproto' }, 'test.mp4', customRegistry);
    expect(result1).toBe('myproto:test.mp4');

    // Default registry does not
    resetHostingRegistry();
    expect(() => resolveMediaUrl({ provider: 'myproto' }, 'test.mp4')).toThrow();
  });

  it('resetHostingRegistry restores default providers', () => {
    registerHostingProvider('custom', { resolve: () => '' });
    resetHostingRegistry();
    // After reset, only local and url-prefix should exist in default registry
    expect(() => resolveMediaUrl({ provider: 'custom' }, 'test.mp4')).toThrow();
  });

  it('default registry includes local and url-prefix', () => {
    resetHostingRegistry();
    // Should work
    const local = resolveMediaUrl({ provider: 'local' }, 'test.mp4');
    expect(local).toBe('test.mp4');

    const urlPrefix = resolveMediaUrl(
      { provider: 'url-prefix', base: 'https://example.com' },
      'test.mp4'
    );
    expect(urlPrefix).toBe('https://example.com/test.mp4');
  });

  it('resolveMediaUrl dispatches through registry', () => {
    const registry = createHostingRegistry();
    registerHostingProvider('test-proto', {
      resolve: (file: string) => 'test-proto://' + file
    }, registry);

    const result = resolveMediaUrl(
      { provider: 'test-proto' },
      'assets/file.mp4',
      registry
    );
    expect(result).toBe('test-proto://assets/file.mp4');
  });

  it('resolveMediaUrl works with config object', () => {
    const hosting = { provider: 'url-prefix', base: 'https://cdn.example.com' };
    const result = resolveMediaUrl(hosting, 'video/test.mp4');
    expect(result).toBe('https://cdn.example.com/video/test.mp4');
  });
});

describe('Hosting registry: built-ins and requiresBase', () => {
  afterEach(() => {
    resetHostingRegistry();
  });

  it('the default registry lists exactly the built-in providers', () => {
    expect(defaultHostingRegistry.names()).toEqual(BUILTIN_HOSTING_PROVIDERS.map((p) => p.name).sort());
  });

  it('local needs no base; url-prefix and r2 do', () => {
    expect(localProvider.requiresBase).not.toBe(true);
    expect(urlPrefixProvider.requiresBase).toBe(true);
    expect(r2Provider.requiresBase).toBe(true);
  });

  it('a registered provider does not require a base unless it asks for one', () => {
    const registry = createHostingRegistry();
    const plain = registerHostingProvider('plain', { resolve: (f: string) => f }, registry);
    const needs = registerHostingProvider('needs-base', { requiresBase: true, resolve: (f: string) => f }, registry);
    expect(plain.requiresBase).toBe(false);
    expect(needs.requiresBase).toBe(true);
  });
});
