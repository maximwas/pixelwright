import { InjectionToken, inject, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import type { TextLayer } from "@/plugin/adapters/figma/layer-factory.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { TEXT_RUNS, type TextRange } from "@/plugin/operations/apply/writers/text-runs.ts";
import {
  type TEXT_BASE_FIELDS,
  TEXT_LINED_FIELDS,
  TEXT_RANGE_FIELD,
  TEXT_STYLED_FIELDS,
} from "@/plugin/operations/apply/writers/writers.constants.ts";

export type BaseSegment = Pick<StyledTextSegment, (typeof TEXT_BASE_FIELDS)[number]> & {
  readonly start: number;
  readonly end: number;
};

/**
 * A text's look across new characters (P-152): its longest run is its own look, restored over all of it after Figma
 * gave new characters the first one's, its style first and then what the style does not set, its colour, link and the
 * variables bound to its type; and the runs that hold the text's own value, which its own properties go to.
 */
@injectable()
export class TextLook {
  readonly #runs;
  readonly #lookup;

  constructor(runs = inject(TEXT_RUNS), lookup = inject(NODE_LOOKUP)) {
    this.#runs = runs;
    this.#lookup = lookup;
  }

  /** The run of most characters: the text's own look. */
  longest<Segment extends { readonly start: number; readonly end: number }>(segments: readonly Segment[]): Segment | undefined {
    return segments.reduce<Segment | undefined>(
      (best, segment) => (best === undefined || segment.end - segment.start > best.end - best.start ? segment : best),
      undefined,
    );
  }

  async restore(node: TextLayer, base: BaseSegment): Promise<void> {
    const range: TextRange = { node, start: 0, end: node.characters.length };
    const styleId = typeof base.textStyleId === "string" && base.textStyleId !== "" ? base.textStyleId : null;
    const style = styleId === null ? null : ((await this.#lookup.style(styleId)) as TextStyle | null);

    if (styleId !== null) {
      await this.#runs.set(range, TEXT_RANGE_FIELD.textStyleId, styleId);
    }

    for (const field of TEXT_STYLED_FIELDS) {
      const value = base[field];
      const drawn = node.type === FIGMA_NODE_TYPE.text || !(TEXT_LINED_FIELDS as readonly string[]).includes(field);

      if (drawn && value !== undefined && (style === null || !isEqual(style[field], value))) {
        await this.#runs.set(range, TEXT_RANGE_FIELD[field], value);
      }
    }

    if (typeof base.fillStyleId === "string" && base.fillStyleId !== "") {
      await this.#runs.set(range, TEXT_RANGE_FIELD.fillStyleId, base.fillStyleId);
    } else if (Array.isArray(base.fills)) {
      await this.#runs.set(range, TEXT_RANGE_FIELD.fills, base.fills);
    }

    if (base.hyperlink !== undefined) {
      await this.#runs.set(range, TEXT_RANGE_FIELD.hyperlink, base.hyperlink ?? null);
    }

    await this.#bindings(range, base);
  }

  /** Writes over the runs that have the text's own value of these fields (all of an empty text). */
  async inherit(
    node: TextLayer,
    fields: readonly (keyof StyledTextSegment)[],
    write: (start: number, end: number) => Promise<void>,
  ): Promise<void> {
    if (node.characters.length === 0) {
      await write(0, 0);

      return;
    }

    const segments = node.getStyledTextSegments([...fields] as (typeof TEXT_BASE_FIELDS)[number][]);
    const value = (segment: (typeof segments)[number]) => fields.map((field) => Reflect.get(segment, field));
    const base = this.longest(segments);

    for (const segment of segments) {
      if (base !== undefined && isEqual(value(segment), value(base))) {
        await write(segment.start, segment.end);
      }
    }
  }

  /** The variables bound to the type (a colour's are the fills', already restored). */
  async #bindings({ node, end }: TextRange, base: BaseSegment): Promise<void> {
    for (const [field, alias] of Object.entries(base.boundVariables ?? {})) {
      const id: unknown = alias?.id;
      const variable = typeof id === "string" ? await this.#lookup.variable(id) : null;

      if (variable !== null && field !== TEXT_RANGE_FIELD.fills.property) {
        node.setRangeBoundVariable(0, end, field as VariableBindableTextField, variable);
      }
    }
  }
}

export const TEXT_LOOK = new InjectionToken<TextLook>("TextLook");
