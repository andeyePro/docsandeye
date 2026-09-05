import { describe, it, expect, afterEach } from 'vitest';
import {
  BUILTIN_HOSTING_PROVIDERS,
  DocsiError,
  createHostingRegistry,
  defaultHostingRegistry,
  parseConfig,
  r2Provider,
  resetHostingRegistry,
  resolveMediaUrl,
} from '../src/index.js';

const GUIDES = 'guides:\n  - {id: main, title: Main, base: /}\n';

describe('r2 hosting provider', () => {
  afterEach(() => {
    resetHostingRegistry();
  });

  // -- resolution ---------------------------------------------------------

  it('resolves base + "/" + file', () => {
    const url = resolveMediaUrl({ provider: 'r2', base: 'https://media.example.org' }, 'build/media/vid-02-seat-720.webm');
    expect(url).toBe('https://media.example.org/build/media/vid-02-seat-720.webm');
  });

  it('collapses a trailing slash on base and a leading slash on the file', () => {
    const url = resolveMediaUrl({ provider: 'r2', base: 'https://media.example.org/' }, '/build/media/vid-02-seat.webp');
    expect(url).toBe('https://media.example.org/build/media/vid-02-seat.webp');
  });

  it('keeps a path segment in base', () => {
    const url = resolveMediaUrl({ provider: 'r2', base: 'https://media.example.org/lamp/' }, 'build/media/vid-02-seat.en.vtt');
    expect(url).toBe('https://media.example.org/lamp/build/media/vid-02-seat.en.vtt');
  });

  it('resolves identically to url-prefix for the same base and file', () => {
    const base = 'https://media.example.org/lamp';
    const file = 'build/media/vid-02-seat-1080.mp4';
    expect(resolveMediaUrl({ provider: 'r2', base }, file)).toBe(resolveMediaUrl({ provider: 'url-prefix', base }, file));
  });

  // -- registry -----------------------------------------------------------

  it('is one of the built-in providers', () => {
    expect(BUILTIN_HOSTING_PROVIDERS.map((p) => p.name)).toContain('r2');
    expect(r2Provider.name).toBe('r2');
    expect(r2Provider.requiresBase).toBe(true);
  });

  it('is listed in the default registry', () => {
    expect(defaultHostingRegistry.has('r2')).toBe(true);
    expect(defaultHostingRegistry.names()).toEqual(['local', 'r2', 'url-prefix']);
  });

  it('is listed in a fresh registry', () => {
    expect(createHostingRegistry().names()).toEqual(['local', 'r2', 'url-prefix']);
  });

  it('survives resetHostingRegistry', () => {
    resetHostingRegistry();
    expect(defaultHostingRegistry.get('r2')).toBeDefined();
  });

  // -- parseConfig --------------------------------------------------------

  it('parseConfig accepts provider r2 with a base', () => {
    const config = parseConfig(`${GUIDES}hosting:\n  provider: r2\n  base: https://media.example.org/`);
    expect(config.hosting.provider).toBe('r2');
    expect(config.hosting.base).toBe('https://media.example.org/');
  });

  it('parseConfig rejects provider r2 without a base', () => {
    expect(() => parseConfig(`${GUIDES}hosting:\n  provider: r2`)).toThrow(DocsiError);
  });

  it('the rejection names hosting.base and the r2 provider', () => {
    let caught: DocsiError | undefined;
    try {
      parseConfig(`${GUIDES}hosting:\n  provider: r2`);
    } catch (err) {
      caught = err as DocsiError;
    }
    expect(caught).toBeInstanceOf(DocsiError);
    expect(caught!.problems).toHaveLength(1);
    expect(caught!.problems[0]!.path).toBe('hosting.base');
    expect(caught!.problems[0]!.message).toContain('r2');
  });

  it('parseConfig rejects an empty base for r2', () => {
    expect(() => parseConfig(`${GUIDES}hosting:\n  provider: r2\n  base: ""`)).toThrow(DocsiError);
  });
});
