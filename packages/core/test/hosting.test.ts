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

/**
 * Hosted URLs are percent-encoded.
 *
 * `url-prefix`/`r2` joined `base` and the project-relative file verbatim, so a
 * media file named by a camera or an editor — a space, a `#`, a `?` in the
 * basename — produced a URL that does not address the object: a `#` truncates
 * at the fragment, a `?` starts a query string. Each segment of the FILE is now
 * `encodeURIComponent`d, `/` kept as the separator; `base` is an absolute URL
 * the maintainer authored and is passed through as written; `local` still
 * returns the file unchanged, because the plugin resolves local media through
 * its own `withBase`, which does its own encoding.
 *
 * Independence note: the expected strings are `encodeURIComponent` applied by
 * hand to the authored basenames, not read back from the implementation.
 */
describe('hosted URLs percent-encode the file path segments', () => {
  afterEach(() => {
    resetHostingRegistry();
  });

  const BASE = 'https://media.example.com';

  it('url-prefix encodes spaces in a path segment', () => {
    expect(resolveMediaUrl({ provider: 'url-prefix', base: BASE }, 'build/media/Clip 2 720.mp4')).toBe(
      'https://media.example.com/build/media/Clip%202%20720.mp4',
    );
  });

  it('url-prefix encodes every segment, not just the basename', () => {
    expect(resolveMediaUrl({ provider: 'url-prefix', base: BASE }, 'Media Files/Take #3/Clip 2.mp4')).toBe(
      'https://media.example.com/Media%20Files/Take%20%233/Clip%202.mp4',
    );
  });

  it('url-prefix encodes the characters that would otherwise change what the URL means', () => {
    const cases: Array<[string, string]> = [
      ['a#b.mp4', 'a%23b.mp4'],
      ['a?b.mp4', 'a%3Fb.mp4'],
      ['a b.mp4', 'a%20b.mp4'],
      ['100%.mp4', '100%25.mp4'],
      ['a&b.mp4', 'a%26b.mp4'],
    ];
    for (const [file, encoded] of cases) {
      expect(resolveMediaUrl({ provider: 'url-prefix', base: BASE }, file), file).toBe(`${BASE}/${encoded}`);
    }
  });

  it('r2 encodes identically to url-prefix', () => {
    const file = 'build/media/Odd Clip #1 720.webm';
    expect(resolveMediaUrl({ provider: 'r2', base: 'https://media.example.org/lamp/' }, file)).toBe(
      'https://media.example.org/lamp/build/media/Odd%20Clip%20%231%20720.webm',
    );
    expect(resolveMediaUrl({ provider: 'r2', base: BASE }, file)).toBe(
      resolveMediaUrl({ provider: 'url-prefix', base: BASE }, file),
    );
  });

  it('leaves an already-safe path byte-for-byte alone', () => {
    expect(resolveMediaUrl({ provider: 'url-prefix', base: BASE }, 'build/media/vid-02-seat-720.webm')).toBe(
      'https://media.example.com/build/media/vid-02-seat-720.webm',
    );
    expect(resolveMediaUrl({ provider: 'url-prefix', base: BASE }, 'build/media/vid-02-seat.en.vtt')).toBe(
      'https://media.example.com/build/media/vid-02-seat.en.vtt',
    );
  });

  it('does not touch the base, even when the base itself contains a space', () => {
    expect(resolveMediaUrl({ provider: 'url-prefix', base: 'https://example.com/my bucket' }, 'a b.mp4')).toBe(
      'https://example.com/my bucket/a%20b.mp4',
    );
  });

  it('strips the leading slash before encoding, so no empty first segment appears', () => {
    expect(resolveMediaUrl({ provider: 'url-prefix', base: `${BASE}/` }, '/build/media/a b.mp4')).toBe(
      'https://media.example.com/build/media/a%20b.mp4',
    );
  });

  it('local still returns the file unchanged, spaces and all', () => {
    expect(resolveMediaUrl({ provider: 'local' }, 'build/media/Clip #2 720.mp4')).toBe('build/media/Clip #2 720.mp4');
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
