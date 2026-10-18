import { sameValue } from "../kernel/equality.ts";
import { attributeOf, type DesignAttribute, type DesignContent, type DesignElement, elementLabel } from "./tree.ts";
import type { RepeatField, RepeatRead } from "./types.ts";

/** Runs shorter than this stay as they are: two alike layers read as well side by side. */
const REPEAT_MIN = 3;

/**
 * What alike layers may hold apart, each one having it or not: what they show (texts, files, variants, component
 * properties and which of them an instance overrides, links, notes and names) and where they sit. Every other attribute, and the shape of their children, is the same in each.
 */
const ROW_ATTRIBUTES: ReadonlySet<string> = new Set([
  "name",
  "$override",
  "src",
  "href",
  "variant",
  "props",
  "note",
  "description",
  "left",
  "top",
  "right",
  "bottom",
]);

/** A field with the way to its layer: the child indexes from the template down. */
interface PlacedField extends RepeatField {
  readonly at: readonly number[];
}

/**
 * The tree with each run of three or more alike neighbours read as its first, marked `$repeat` with the run's length,
 * and the run's layers listed with their own values. A template is kept whole: its values are its run's first row, so
 * nothing in it folds again.
 */
export function foldRepeats(root: DesignElement | null): { root: DesignElement | null; repeats: RepeatRead[] } {
  const repeats: RepeatRead[] = [];

  return {
    root: root === null ? null : folded(root, repeats),
    repeats,
  };
}

function folded(element: DesignElement, repeats: RepeatRead[]): DesignElement {
  return {
    ...element,
    children: runsOf(element.children).flatMap((run) => {
      const [template] = run;

      if (template === undefined || run.length < REPEAT_MIN) {
        return run.map((child) => folded(child, repeats));
      }

      repeats.push(repeatOf(template, run));

      return [
        {
          ...template,
          attributes: [...template.attributes, ["$repeat", String(run.length)]],
        },
      ];
    }),
  };
}

/** Children in runs of alike neighbours, in document order. */
function runsOf(children: readonly DesignElement[]): DesignElement[][] {
  const runs: DesignElement[][] = [];

  for (const child of children) {
    const run = runs.at(-1);
    const first = run?.[0];

    if (run !== undefined && first !== undefined && alike(first, child)) {
      run.push(child);
    } else {
      runs.push([child]);
    }
  }

  return runs;
}

/**
 * Whether two layers are alike: one tag, the same attributes in one order holding the same values but the row ones,
 * the same text pieces, and children alike one by one.
 */
function alike(mine: DesignElement, theirs: DesignElement): boolean {
  return (
    mine.tag === theirs.tag &&
    sameValue(kept(mine), kept(theirs)) &&
    sameContent(mine.content, theirs.content) &&
    mine.children.length === theirs.children.length &&
    mine.children.every((child, index) => {
      const other = theirs.children[index];

      return other !== undefined && alike(child, other);
    })
  );
}

/** The attributes alike layers share: all but the id and the row ones. */
function kept(element: DesignElement): DesignAttribute[] {
  return element.attributes.filter(([name]) => name !== "id" && !ROW_ATTRIBUTES.has(name));
}

/** Texts alike piece by piece: the same pieces, each span with the same attributes; their characters aside. */
function sameContent(mine: readonly DesignContent[] | null, theirs: readonly DesignContent[] | null): boolean {
  if (mine === null || theirs === null) {
    return mine === theirs;
  }

  return (
    mine.length === theirs.length &&
    mine.every((piece, index) => {
      const other = theirs[index];

      return other !== undefined && piece.kind === other.kind && sameValue(spanOf(piece), spanOf(other));
    })
  );
}

function spanOf(piece: DesignContent): readonly DesignAttribute[] | null {
  return piece.kind === "span" ? piece.attributes : null;
}

/** A run as its template, its layers and the values its layers hold apart, a row per layer. */
function repeatOf(template: DesignElement, run: readonly DesignElement[]): RepeatRead {
  const fields = fieldsOf(template, run, [], "").filter((field) =>
    run.some((element) => !sameValue(fieldValue(element, field), fieldValue(template, field))),
  );

  return {
    template: template.id,
    layers: run.map(({ id }) => id),
    fields: fields.map(({ at: _at, ...field }) => field),
    rows: run.map((element) => fields.map((field) => fieldValue(element, field))),
  };
}

/**
 * Every value the template's layers may hold apart, down from it: each layer's row attributes (the template's in its
 * order, then those only others in the run have), then its text.
 */
function fieldsOf(
  element: DesignElement,
  run: readonly DesignElement[],
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
      .flatMap((member) => (layerAt(member, at)?.attributes ?? []).map(([name]) => name))
      .filter((name) => ROW_ATTRIBUTES.has(name)),
  );

  return [
    ...[...rowNames].map(placed),
    ...(element.content === null ? [] : [placed("$text")]),
    ...element.children.flatMap((child, index) => {
      const name = attributeOf(child, "name");
      const key = `${child.tag} ${name ?? ""}`;
      const count = seen.get(key) ?? 0;
      const label = elementLabel(child.tag, name, count);

      seen.set(key, count + 1);

      return fieldsOf(child, run, [...at, index], path === "" ? label : `${path} / ${label}`);
    }),
  ];
}

/** A field's value in one layer of the run: the attribute, or the text, a text with spans as its pieces. */
function fieldValue(element: DesignElement, field: PlacedField): string | readonly string[] {
  const layer = layerAt(element, field.at);

  if (field.attribute !== "$text") {
    return layer === undefined ? "" : (attributeOf(layer, field.attribute) ?? "");
  }

  const pieces = layer?.content ?? [];
  const [only] = pieces;

  return pieces.length === 1 && only?.kind === "text" ? only.value : pieces.map(({ value }) => value);
}

/** The layer at a place in a run's member: the child indexes from it down. */
function layerAt(element: DesignElement, at: readonly number[]): DesignElement | undefined {
  return at.reduce<DesignElement | undefined>((within, index) => within?.children[index], element);
}
