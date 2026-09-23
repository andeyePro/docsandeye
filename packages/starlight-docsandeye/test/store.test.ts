/**
 * The reader's saved state when `localStorage` is unavailable: the page must
 * keep the reader's answers for the visit (an in-memory copy), not fall back
 * to the defaults on every re-read.
 */
import { afterEach, describe, expect, it } from 'vitest';
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

  it('with working storage, values written are persisted and read back', () => {
    const data = new Map<string, string>();
    g.window = { localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } };
    writeStorage('docsandeye:test:c', '{"a":1}');
    expect(data.get('docsandeye:test:c')).toBe('{"a":1}');
    expect(readRecord('docsandeye:test:c')).toEqual({ a: 1 });
  });
});
