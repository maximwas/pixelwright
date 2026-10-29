import { CSS_ORDER } from "@/core/css/css.constants.ts";

/** One CSS property and its value. */
export type CssDeclaration = readonly [property: string, value: string];

/** A layer's CSS: what design_apply can write back, in CSS_ORDER, and the notes it cannot (`$css`). */
export interface LayerCss {
  readonly properties: CssDeclaration[];
  readonly notes: CssDeclaration[];
}

/** A layer's CSS as the groups read it, one builder per layer: properties sorted by CSS_ORDER, notes as given. */
export class CssDeclarations {
  readonly #properties = new Map<string, string>();
  readonly #notes: CssDeclaration[] = [];

  set(property: string, value: string): void {
    this.#properties.set(property, value);
  }

  get(property: string): string | undefined {
    return this.#properties.get(property);
  }

  /** CSS design_apply cannot write back: shown in `$css`, never written. */
  note(property: string, value: string): void {
    this.#notes.push([property, value]);
  }

  build(): LayerCss {
    return {
      properties: [...this.#properties].sort(([first], [second]) => this.#rank(first) - this.#rank(second)),
      notes: [...this.#notes],
    };
  }

  #rank(property: string): number {
    const index = CSS_ORDER.indexOf(property);

    return index === -1 ? CSS_ORDER.length : index;
  }
}
