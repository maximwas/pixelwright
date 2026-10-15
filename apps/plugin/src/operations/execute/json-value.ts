import { EXECUTE_RESULT_DEPTH } from "@pixelwright/core";

/**
 * A value code returned, as JSON can carry it: a layer as its id, type and name, figma.mixed as "mixed", bytes as their
 * count, a cycle as "[circular]", what lies too deep as "[…]". Like JSON, undefined and functions drop out of objects
 * and become null in arrays and on their own.
 */
export function jsonValue(value: unknown, path: Set<object> = new Set(), depth = 0): unknown {
  if (typeof value !== "object" || value === null) {
    return scalarValue(value);
  }

  if (path.has(value)) {
    return "[circular]";
  }

  if (depth >= EXECUTE_RESULT_DEPTH) {
    return "[…]";
  }

  return knownObject(value) ?? walked(value, path, depth);
}

function scalarValue(value: unknown): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "symbol") {
    return value === figma.mixed ? "mixed" : value.toString();
  }

  return null;
}

/** What JSON cannot walk as it is: a Figma layer, bytes, a date, an error; undefined for data to walk. */
function knownObject(value: object): unknown {
  const layer = value as { id?: unknown; type?: unknown; name?: unknown; remove?: unknown };

  // Figma's own layers only (they can be removed): plain data with an id and a type is walked as data.
  if (typeof layer.id === "string" && typeof layer.type === "string" && typeof layer.remove === "function") {
    return {
      id: layer.id,
      type: layer.type,
      name: typeof layer.name === "string" ? layer.name : "",
    };
  }

  if (value instanceof Uint8Array) {
    return { bytes: value.length };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value instanceof Error ? `${value.name}: ${value.message}` : undefined;
}

/** An array, set, map or object, its items made JSON-safe one level deeper. */
function walked(value: object, path: Set<object>, depth: number): unknown {
  path.add(value);

  try {
    if (Array.isArray(value) || value instanceof Set) {
      return [...value].map((item) => jsonValue(item, path, depth + 1) ?? null);
    }

    const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);

    return Object.fromEntries(
      entries
        .filter(([, item]) => item !== undefined && typeof item !== "function")
        .map(([key, item]) => [String(key), jsonValue(item, path, depth + 1)]),
    );
  } finally {
    path.delete(value);
  }
}
