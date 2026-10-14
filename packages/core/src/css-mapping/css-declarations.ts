import type { CssContext, NodeCss } from "../types/css.ts";
import type { SnapshotNode } from "../types/snapshot.ts";
import { withoutFallbacks } from "./values/css-values.ts";
import { px } from "./values/format.ts";
import { lengthCss } from "./values/lengths.ts";
import { CSS_ORDER } from "./vocabulary.ts";

/**
 * A layer's CSS as it is read: what design_apply can write back, put in the one order every read writes, and what it
 * cannot write back yet (read-only, cleaned as ours is written). One builder per layer.
 */
export class CssDeclarations {
  readonly #node: SnapshotNode;
  readonly #context: CssContext;
  readonly #properties = new Map<string, string>();
  readonly #readOnly: [string, string][] = [];

  constructor(node: SnapshotNode, context: CssContext) {
    this.#node = node;
    this.#context = context;
  }

  set(property: string, value: string): void {
    this.#properties.set(property, value);
  }

  get(property: string): string | undefined {
    return this.#properties.get(property);
  }

  /** The layer's length in field `key`, or the token of the variable bound to that field. */
  length(key: string, value: number): string {
    return lengthCss(this.#node, key, value, this.#context);
  }

  /** A length as `property`; nothing for a zero, except a size, which a box always has. */
  setLength(property: string, key: string, value: number | undefined): void {
    if (value === undefined) {
      return;
    }

    const written = this.length(key, value);

    if (written !== "0" || property === "width" || property === "height") {
      this.#properties.set(property, written);
    }
  }

  /** CSS the mapping cannot write back yet: shown, never written. */
  readOnly(property: string, value: string): void {
    this.#readOnly.push([property, value]);
  }

  build(textStyle?: string): NodeCss {
    return {
      properties: [...this.#properties].sort(([a], [b]) => order(a) - order(b)),
      readOnly: this.#readOnly.map(([property, value]) => [property, cleanOracle(value)]),
      ...(textStyle === undefined ? {} : { textStyle }),
    };
  }
}

/** getCSSAsync's value made like ours: no fallbacks inside var(), no comments, whole pixels. */
export function cleanOracle(value: string): string {
  return withoutFallbacks(value)
    .replace(/(-?\d+\.\d+)px/g, (_match, number: string) => px(Number(number)))
    .trim();
}

function order(property: string): number {
  const index = (CSS_ORDER as readonly string[]).indexOf(property);

  return index === -1 ? CSS_ORDER.length : index;
}
