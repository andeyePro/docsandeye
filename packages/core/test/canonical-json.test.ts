import { describe, it, expect } from 'vitest';
import { canonicalJson } from '../src/index.js';

describe('AC15: Canonical JSON', () => {
  it('sorts object keys recursively', () => {
    const value = {
      z: 1,
      a: 2,
      m: { y: 3, b: 4, x: 5 }
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    const topKeys = Object.keys(parsed);
    expect(topKeys).toEqual(['a', 'm', 'z']);
    const nestedKeys = Object.keys(parsed.m);
    expect(nestedKeys).toEqual(['b', 'x', 'y']);
  });

  it('preserves array order', () => {
    const value = {
      items: [3, 1, 2]
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    expect(parsed.items).toEqual([3, 1, 2]);
  });

  it('emits 2-space indentation by default', () => {
    const value = { a: 1, b: { c: 2 } };
    const json = canonicalJson(value);
    expect(json).toContain('  ');
    const lines = json.split('\n');
    // Check that there is indentation
    const hasIndent = lines.some(line => line.startsWith('  '));
    expect(hasIndent).toBe(true);
  });

  it('emits compact output when compact option is true', () => {
    const value = { a: 1, b: { c: 2 } };
    const json = canonicalJson(value, { compact: true });
    // Compact should not have newlines or spaces
    expect(json).not.toContain('\n');
    expect(json.includes('  ')).toBe(false);
  });

  it('round-trips through JSON.parse to deep-equal value', () => {
    const value = {
      z: 1,
      a: [1, 2, 3],
      m: { y: 'str', b: true, x: null }
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(value);
  });

  it('handles nested arrays and objects', () => {
    const value = {
      z: [{ b: 1, a: 2 }, { y: 3, x: 4 }],
      a: { nested: { z: 1, a: 2 } }
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    // All nested objects should have sorted keys
    expect(Object.keys(parsed)).toEqual(['a', 'z']);
    expect(Object.keys(parsed.a.nested)).toEqual(['a', 'z']);
  });

  it('preserves primitives: null, boolean, number, string', () => {
    const value = {
      nullValue: null,
      boolTrue: true,
      boolFalse: false,
      num: 42,
      str: 'hello'
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    expect(parsed.nullValue).toBeNull();
    expect(parsed.boolTrue).toBe(true);
    expect(parsed.boolFalse).toBe(false);
    expect(parsed.num).toBe(42);
    expect(parsed.str).toBe('hello');
  });

  it('compact format is valid JSON', () => {
    const value = { z: 1, a: { y: 2, b: 3 } };
    const json = canonicalJson(value, { compact: true });
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(value);
  });

  it('non-compact format is valid JSON', () => {
    const value = { z: 1, a: { y: 2, b: 3 } };
    const json = canonicalJson(value, { compact: false });
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(value);
  });

  it('handles empty objects and arrays', () => {
    const value = {
      empty_obj: {},
      empty_arr: []
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    expect(parsed.empty_obj).toEqual({});
    expect(parsed.empty_arr).toEqual([]);
  });

  it('handles deeply nested structures', () => {
    const value = {
      level1: {
        z: 1,
        level2: {
          y: 2,
          level3: {
            x: 3,
            a: 4
          }
        },
        a: 5
      }
    };
    const json = canonicalJson(value);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(value);
    // Verify keys are sorted at all levels
    expect(Object.keys(parsed)).toEqual(['level1']);
    expect(Object.keys(parsed.level1)).toEqual(['a', 'level2', 'z']);
    expect(Object.keys(parsed.level1.level2)).toEqual(['level3', 'y']);
    expect(Object.keys(parsed.level1.level2.level3)).toEqual(['a', 'x']);
  });

  it('compact version is shorter than non-compact', () => {
    const value = { z: 1, a: { y: 2, b: 3 } };
    const compact = canonicalJson(value, { compact: true });
    const nonCompact = canonicalJson(value, { compact: false });
    expect(compact.length).toBeLessThan(nonCompact.length);
  });
});
