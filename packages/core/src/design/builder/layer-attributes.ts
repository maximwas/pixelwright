import type { SnapshotNode, TextSegment } from "../../types/snapshot.ts";
import { ANNOTATION_PINS, TEXT_ANNOTATION_PINS } from "../vocabulary.ts";

/** A metadata attribute, or nothing when the layer has none of it. */
type MaybeAttribute = readonly [string, string | undefined];

const VARIANT_PROPERTY: ReadonlySet<string> = new Set(["VARIANT"]);

/** An instance's own settings: its texts and toggles (a swapped instance and a slot show as children). */
const OWN_PROPERTIES: ReadonlySet<string> = new Set(["TEXT", "BOOLEAN"]);

/** An instance's component (its set's name for a variant), its variant values, its own properties and its exposure. */
export function componentAttributes(node: SnapshotNode): MaybeAttribute[] {
  if (node.instance === undefined) {
    return [];
  }

  const { setName, componentName, properties, exposed } = node.instance;
  const listed = (types: ReadonlySet<string>) =>
    Object.entries(properties)
      .filter(([, property]) => types.has(property.type))
      // Figma suffixes a non-variant property's name with its id: "Label#12:0".
      .map(([name, property]) => `${listItem(name.replace(/#[^#]*$/, ""))}=${listItem(String(property.value))}`)
      .join(", ");
  const variant = listed(VARIANT_PROPERTY);
  const props = listed(OWN_PROPERTIES);

  return [
    ["component", setName ?? componentName],
    ["variant", setName === undefined || variant === "" ? undefined : variant],
    ["props", props === "" ? undefined : props],
    ["$exposed", exposed ? "true" : undefined],
  ];
}

/** The designer's Dev Mode notes, each with its category, separated by ` | ` (a bar inside a note is escaped). */
export function noteOf(node: SnapshotNode): string | undefined {
  const notes = (node.annotations ?? []).flatMap(({ label, category }) =>
    label === undefined
      ? []
      : [(category === undefined ? label : `${category}: ${label}`).replace(/[\\|]/g, (char) => `\\${char}`)],
  );

  return notes.length === 0 ? undefined : notes.join(" | ");
}

/** The properties pinned in the layer's annotations, in CSS words, in the order pinned, each once. */
export function pinsOf(node: SnapshotNode): string | undefined {
  const words = new Set(
    (node.annotations ?? []).flatMap(({ pins }) =>
      (pins ?? []).map(
        (pin) => (node.type === "TEXT" ? TEXT_ANNOTATION_PINS[pin] : undefined) ?? ANNOTATION_PINS[pin] ?? pin,
      ),
    ),
  );

  return words.size === 0 ? undefined : [...words].join(", ");
}

/** The URL every given run links to, if they all link to the same one. */
export function urlOf(segments: readonly TextSegment[]): string | undefined {
  const urls = new Set(
    segments.map((segment) => (segment.hyperlink?.type === "URL" ? segment.hyperlink.value : undefined)),
  );
  const [url] = urls;

  return urls.size === 1 ? url : undefined;
}

/** The read-only CSS of a layer; an asset keeps only its blend mode, which no exported file holds. */
export function readOnlyOf(readOnly: readonly [string, string][], isAsset: boolean): string | undefined {
  const kept = isAsset ? readOnly.filter(([property]) => property === "mix-blend-mode") : readOnly;

  return kept.length === 0 ? undefined : kept.map(([property, value]) => `${property}: ${value}`).join("; ");
}

/** How many children a layer has when the snapshot or the fit to maxChars did not list them all. */
export function cutCount(node: SnapshotNode, limit?: number): string | undefined {
  const listed = Math.min(node.children?.length ?? 0, limit ?? Number.POSITIVE_INFINITY);

  return listed < node.childCount ? String(node.childCount) : undefined;
}

/** A name or value in a `Name=Value, …` list: backslash before the separators, so a value with them reads back whole. */
function listItem(text: string): string {
  return text.replace(/[\\,=]/g, (char) => `\\${char}`);
}
