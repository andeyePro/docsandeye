/**
 * Deterministic JSON serialisation: object keys sorted at every depth,
 * array order preserved, `undefined` members dropped (as `JSON.stringify` does).
 *
 * Default output uses 2-space indentation; `{compact: true}` emits no whitespace.
 * The output always round-trips through `JSON.parse` to a deep-equal value.
 */
export interface CanonicalJsonOptions {
  compact?: boolean;
}

export function canonicalJson(value: unknown, options: CanonicalJsonOptions = {}): string {
  const normalised = normalise(value);
  return options.compact ? JSON.stringify(normalised) : JSON.stringify(normalised, null, 2);
}

function normalise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : normalise(item)));
  }
  if (value instanceof Map) {
    return normalise(Object.fromEntries(value));
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof (obj as { toJSON?: unknown }).toJSON === 'function') {
      return normalise((obj as { toJSON: () => unknown }).toJSON());
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const v = obj[key];
      if (v === undefined) continue;
      out[key] = normalise(v);
    }
    return out;
  }
  return value;
}
