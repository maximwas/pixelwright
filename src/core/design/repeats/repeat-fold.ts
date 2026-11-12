import { InjectionToken, injectable } from "@needle-di/core";
import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import { REPEATS, ROW_ATTRIBUTES } from "@/core/design/repeats/repeats.constants.ts";
import type { RepeatField, RepeatRead } from "@/core/design/repeats/repeats.types.ts";
import { XML_CONTENT } from "@/core/xml/xml.constants.ts";
import type { XmlAttribute, XmlContent, XmlElement } from "@/core/xml/xml.types.ts";

/** A field with the way to its layer: the child indexes from the template down. */
interface PlacedField extends RepeatField {
  readonly at: readonly number[];
}

/** A run's value at one field: an attribute, a text, or a text with spans as its pieces. */
type FieldValue = string | readonly string[];

/**
 * The tree with each run of three or more alike neighbours read as its first, marked `$repeat` with the run's length,
 * and the run's layers listed with their own values (T-059). A template is kept whole: its values are its run's first
 * row, so nothing in it folds again. A folded read sent back changes only the first: design_apply never deletes.
 */
@injectable()
export class RepeatFold {
  fold(root: XmlElement | null): { root: XmlElement | null; repeats: RepeatRead[] } {
    const repeats: RepeatRead[] = [];

    return { root: root === null ? null : this.#folded(root, repeats), repeats };
  }

  #folded(element: XmlElement, repeats: RepeatRead[]): XmlElement {
    return {
      ...element,
      children: this.#runs(element.children).flatMap((run) => {
        const [template] = run;

        if (template === undefined || run.length < REPEATS.min) {
          return run.map((child) => this.#folded(child, repeats));
        }

        repeats.push(this.#repeat(template, run));

        return [{ ...template, attributes: [...template.attributes, [DESIGN_ATTRIBUTE.repeat, String(run.length)]] }];
      }),
    };
  }

  /** Children in runs of alike neighbours, in document order. */
  #runs(children: readonly XmlElement[]): XmlElement[][] {
    const runs: XmlElement[][] = [];

    for (const child of children) {
      const run = runs.at(-1);
      const first = run?.[0];

      if (run !== undefined && first !== undefined && this.#alike(first, child)) {
        run.push(child);
      } else {
        runs.push([child]);
      }
    }

    return runs;
  }

  /**
   * Whether two layers are alike: one tag, the same attributes in one order holding the same values but the row ones,
   * the same text pieces (each span with the same attributes, characters aside), and children alike one by one. The
   * values compared are ordered lists of strings, so their JSON is a fair comparison.
   */
  #alike(mine: XmlElement, theirs: XmlElement): boolean {
    return (
      mine.tag === theirs.tag &&
      JSON.stringify(this.#kept(mine)) === JSON.stringify(this.#kept(theirs)) &&
      JSON.stringify(this.#shape(mine.content)) === JSON.stringify(this.#shape(theirs.content)) &&
      mine.children.length === theirs.children.length &&
      mine.children.every((child, index) => {
        const other = theirs.children[index];

        return other !== undefined && this.#alike(child, other);
      })
    );
  }

  /** The attributes alike layers share: all but the id and the row ones. */
  #kept(element: XmlElement): XmlAttribute[] {
    return element.attributes.filter(([name]) => name !== DESIGN_ATTRIBUTE.id && !ROW_ATTRIBUTES.has(name));
  }

  /** A text's pieces without their characters: each piece's kind and a span's attributes. */
  #shape(content: readonly XmlContent[] | null): unknown {
    return content?.map((piece) => (piece.kind === XML_CONTENT.span ? [piece.kind, piece.attributes] : [piece.kind]));
  }

  /** A run as its template, its layers and the values its layers hold apart, a row per layer. */
  #repeat(template: XmlElement, run: readonly XmlElement[]): RepeatRead {
    const fields = this.#fields(template, run, [], "").filter((field) =>
      run.some(
        (element) => JSON.stringify(this.#value(element, field)) !== JSON.stringify(this.#value(template, field)),
      ),
    );

    return {
      template: template.id,
      layers: run.map(({ id }) => id),
      fields: fields.map(({ at: _at, ...field }) => field),
      rows: run.map((element) => fields.map((field) => this.#value(element, field))),
    };
  }

  /**
   * Every value the template's layers may hold apart, down from it: each layer's row attributes (the template's in its
   * order, then those only others in the run have), then its text.
   */
  #fields(
    element: XmlElement,
    run: readonly XmlElement[],
    at: readonly number[],
    path: string,
  ): PlacedField[] {
    const placed = (attribute: string): PlacedField => ({
      layer: element.id,
      ...(path === "" ? {} : { path }),
      attribute,
      at,
    });
    const seen = new Map<string, number>();
    const rowNames = new Set(
      run
        .flatMap((member) => (this.#layerAt(member, at)?.attributes ?? []).map(([name]) => name))
        .filter((name) => ROW_ATTRIBUTES.has(name)),
    );

    return [
      ...[...rowNames].map(placed),
      ...(element.content === null ? [] : [placed(REPEATS.text)]),
      ...element.children.flatMap((child, index) => {
        const name = this.#attribute(child, DESIGN_ATTRIBUTE.name) ?? "";
        const key = JSON.stringify([child.tag, name]);
        const count = seen.get(key) ?? 0;
        const label = REPEATS.label(child.tag, name, count);

        seen.set(key, count + 1);

        return this.#fields(child, run, [...at, index], path === "" ? label : [path, label].join(REPEATS.separator));
      }),
    ];
  }

  /** A field's value in one layer of the run: the attribute, or the text, a text with spans as its pieces. */
  #value(element: XmlElement, field: PlacedField): FieldValue {
    const layer = this.#layerAt(element, field.at);

    if (field.attribute !== REPEATS.text) {
      return layer === undefined ? "" : (this.#attribute(layer, field.attribute) ?? "");
    }

    const pieces = layer?.content ?? [];
    const [only] = pieces;

    return pieces.length === 1 && only?.kind === XML_CONTENT.text ? only.value : pieces.map(({ value }) => value);
  }

  /** The layer at a place in a run's member: the child indexes from it down. */
  #layerAt(element: XmlElement, at: readonly number[]): XmlElement | undefined {
    return at.reduce<XmlElement | undefined>((within, index) => within?.children[index], element);
  }

  #attribute(element: XmlElement, name: string): string | undefined {
    return element.attributes.find(([attribute]) => attribute === name)?.[1];
  }
}

export const REPEAT_FOLD = new InjectionToken<RepeatFold>("RepeatFold");
