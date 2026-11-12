import { CODE_OUTPUT, CODE_PRINT, CODE_TEXT } from "@/plugin/operations/execute/execute.constants.ts";

/**
 * A value code returned or printed (P-162, D-68). As a result, what JSON can carry: a layer as its id, type and name,
 * figma.mixed as "mixed", bytes as their count, a cycle as "[circular]", what lies too deep as "[…]", a result too long
 * for one answer as its start. Printed, faithfully: a string as itself, undefined, a number or a function as String
 * gives it, the rest as that JSON.
 */
export class CodeValue {
  readonly #mixed: symbol;

  constructor(mixed: symbol) {
    this.#mixed = mixed;
  }

  result(value: unknown): unknown {
    const safe = this.#safe(value, new Set(), 0) ?? null;
    const json = JSON.stringify(safe) ?? CODE_PRINT.null;

    return json.length <= CODE_OUTPUT.resultChars
      ? safe
      : { truncated: true, preview: json.slice(0, CODE_OUTPUT.resultChars) };
  }

  printed(value: unknown): string {
    if (value === this.#mixed) {
      return CODE_PRINT.mixed;
    }

    if (typeof value !== "object" || value === null) {
      return typeof value === "string" ? value : String(value);
    }

    return JSON.stringify(this.#safe(value, new Set(), 0)) ?? String(value);
  }

  /** Like JSON, undefined and functions drop out of objects and become null in arrays and on their own. */
  #safe(
    value: unknown,
    path: Set<object>,
    depth: number,
  ): unknown {
    if (typeof value !== "object" || value === null) {
      return this.#scalar(value);
    }

    if (path.has(value)) {
      return CODE_PRINT.circular;
    }

    if (depth >= CODE_OUTPUT.resultDepth) {
      return CODE_PRINT.tooDeep;
    }

    return this.#known(value) ?? this.#walked(value, path, depth);
  }

  #scalar(value: unknown): unknown {
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
      return value === this.#mixed ? CODE_PRINT.mixed : value.toString();
    }

    return null;
  }

  /** What JSON cannot walk as it is: a Figma layer, bytes, a date, an error; undefined for data to walk. */
  #known(value: object): unknown {
    const layer = value as { id?: unknown; type?: unknown; name?: unknown; remove?: unknown };

    // Figma's own layers only (they can be removed): plain data with an id and a type is walked as data.
    if (typeof layer.id === "string" && typeof layer.type === "string" && typeof layer.remove === "function") {
      return { id: layer.id, type: layer.type, name: typeof layer.name === "string" ? layer.name : "" };
    }

    if (value instanceof Uint8Array) {
      return { bytes: value.length };
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return value instanceof Error ? CODE_TEXT.thrown(value.name, value.message) : undefined;
  }

  /** An array, set, map or object, its items made JSON-safe one level deeper. */
  #walked(
    value: object,
    path: Set<object>,
    depth: number,
  ): unknown {
    path.add(value);

    try {
      if (Array.isArray(value) || value instanceof Set) {
        return [...value].map((item: unknown) => this.#safe(item, path, depth + 1) ?? null);
      }

      const entries: [unknown, unknown][] = value instanceof Map ? [...value.entries()] : Object.entries(value);

      return Object.fromEntries(
        entries
          .filter(([, item]) => item !== undefined && typeof item !== "function")
          .map(([key, item]) => [String(key), this.#safe(item, path, depth + 1)]),
      );
    } finally {
      path.delete(value);
    }
  }
}
