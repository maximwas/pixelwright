import { EXECUTE_RESULT_DEPTH } from "@pixelwright/core";

/**
 * A value code returned, as JSON can carry it: a layer as its id, type and name, figma.mixed as "mixed", bytes as their
 * count, a cycle as "[circular]", what lies too deep as "[…]". Like JSON, undefined and functions drop out of objects
 * and become null in arrays and on their own.
 */
export function jsonValue(value: unknown, path: Set<object> = new Set(), depth = 0): unknown {
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

  if (typeof value !== "object") {
    return null;
  }

  if (path.has(value)) {
    return "[circular]";
  }

  if (depth >= EXECUTE_RESULT_DEPTH) {
    return "[…]";
  }

  const layer = value as { id?: unknown; type?: unknown; name?: unknown };

  if (typeof layer.id === "string" && typeof layer.type === "string") {
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

  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

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
