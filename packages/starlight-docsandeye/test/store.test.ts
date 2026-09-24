/**
 * The reader's saved state when `localStorage` is unavailable: the page must
 * keep the reader's answers for the visit (an in-memory copy), not fall back
 * to the defaults on every re-read. And the consent gate (task_021): nothing
 * reaches `localStorage` before "Save".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readRecord, readStorage, writeStorage } from '../src/elements/store.ts';

const g = globalThis as { window?: unknown };

afterEach(() => {
  delete g.window;
});

describe('store: localStorage failures', () => {
  it('a write that throws is still read back for this visit', () => {
    g.window = {
      get localStorage(): never {
        throw new Error('SecurityError');
      },
    };
    expect(readStorage('docsandeye:test:a')).toBeNull();
    writeStorage('docsandeye:test:a', JSON.stringify({ units: 3 }));
    expect(readRecord('docsandeye:test:a')).toEqual({ units: 3 });
  });

  it('getItem/setItem that throw (quota, private mode) behave the same', () => {
    g.window = {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    };
    writeStorage('docsandeye:test:b', '{"step":{"x":"no"}}');
    expect(readRecord('docsandeye:test:b')).toEqual({ step: { x: 'no' } });
  });

  it('with working storage and consent, values written are persisted and read back', async () => {
    vi.resetModules();
    const store = await import('../src/elements/store.ts');
    const data = new Map<string, string>([['docsandeye:consent', 'yes']]);
    g.window = { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } };
    store.writeStorage('docsandeye:test:c', '{"a":1}');
    expect(data.get('docsandeye:test:c')).toBe('{"a":1}');
    expect(store.readRecord('docsandeye:test:c')).toEqual({ a: 1 });
  });
});

describe('store: saving consent', () => {
  const g2 = globalThis as { window?: unknown; document?: unknown };
  let data: Map<string, string>;
  let events: string[];

  beforeEach(() => {
    vi.resetModules();
    data = new Map();
    events = [];
    g2.window = { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } };
    g2.document = { dispatchEvent: (e: Event) => void events.push(e.type) };
  });

  afterEach(() => {
    delete g2.document;
  });

  it('before a decision nothing is written; the first change asks once', async () => {
    const store = await import('../src/elements/store.ts');
    expect(store.consentState()).toBe('unasked');
    expect(store.hasChanges()).toBe(false);
    store.writeStorage('docsandeye:profile:g', '{"units":2}');
    store.writeStorage('docsandeye:parts:g', '{"s/w":true}');
    expect(data.size).toBe(0);
    expect(store.hasChanges()).toBe(true);
    expect(events).toEqual([store.CONSENT_EVENT]);
    expect(store.readRecord('docsandeye:profile:g')).toEqual({ units: 2 });
  });

  it('Save records consent and writes everything changed so far, then every later write', async () => {
    const store = await import('../src/elements/store.ts');
    store.writeStorage('docsandeye:profile:g', '{"units":2}');
    store.setConsent(true);
    expect(data.get('docsandeye:consent')).toBe('yes');
    expect(data.get('docsandeye:profile:g')).toBe('{"units":2}');
    store.writeStorage('docsandeye:checks:g', '{}');
    expect(data.get('docsandeye:checks:g')).toBe('{}');
    expect(store.consentState()).toBe('yes');
  });

  it("Don't save keeps answers for the visit only and never writes", async () => {
    const store = await import('../src/elements/store.ts');
    store.writeStorage('docsandeye:profile:g', '{"units":2}');
    store.setConsent(false);
    store.writeStorage('docsandeye:profile:g', '{"units":3}');
    expect(data.size).toBe(0);
    expect(store.consentState()).toBe('no');
    expect(store.readRecord('docsandeye:profile:g')).toEqual({ units: 3 });
  });

  it('consent given on an earlier visit is read back', async () => {
    data.set('docsandeye:consent', 'yes');
    const store = await import('../src/elements/store.ts');
    store.writeStorage('docsandeye:receipt:g', '{"w":1}');
    expect(data.get('docsandeye:receipt:g')).toBe('{"w":1}');
    expect(events).toEqual([]);
  });
});
