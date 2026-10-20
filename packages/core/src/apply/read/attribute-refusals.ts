import { BOX_PAINT, LAYOUT_ATTRIBUTES, LAYOUT_TAGS, TEXT_ATTRIBUTES } from "../../css-mapping/vocabulary.ts";
import { SHAPE_TAGS } from "../vocabulary.ts";

/** An attribute on a tag, where design_apply reads it. */
interface Use {
  readonly tag: string;
  readonly name: string;
  readonly value: string;
  /** Inside a new Component. */
  readonly inComponent: boolean;
}

/** A rule a tag's attribute can break: when it applies, and what to say and write instead. */
interface Refusal {
  readonly applies: (use: Use) => boolean;
  readonly message: (use: Use) => string;
  readonly hint: (use: Use) => string;
}

/** Why a tag cannot take an attribute, the first rule that applies; null when it can. */
export function refusalOf(use: Use): { message: string; hint: string } | null {
  const refusal = ATTRIBUTE_REFUSALS.find((rule) => rule.applies(use));

  return refusal === undefined
    ? null
    : {
        message: refusal.message(use),
        hint: refusal.hint(use),
      };
}

const layout = (tag: string) => LAYOUT_TAGS.has(tag);

/** The rules in the order they are checked. */
const ATTRIBUTE_REFUSALS: readonly Refusal[] = [
  {
    applies: ({ tag, name }) => tag === "Page" && name !== "id" && name !== "name",
    message: ({ name }) => `A <Page> takes only a name: ${name} is not written.`,
    hint: () => "Give it on the layers in the page.",
  },
  {
    applies: ({ name, inComponent }) => (name === "prop" || name === "visibleProp") && !inComponent,
    message: ({ name }) => `${name} makes a property of a new <Component>: this layer is in none.`,
    hint: () => "Use it on the layers inside a <Component> you create.",
  },
  {
    applies: ({ tag, name, value }) => name === "display" && !layout(tag) && value !== "none" && value !== "block",
    message: ({ tag }) => `A <${tag}> has no auto layout: display takes none (hidden) or block here.`,
    hint: () => 'Put the layers in a <Frame display="flex">.',
  },
  {
    applies: ({ tag, name }) => LAYOUT_ATTRIBUTES.has(name) && !layout(tag),
    message: ({ tag, name }) => `${name} lays out a frame's children: a <${tag}> has none.`,
    hint: () => 'Put the layers in a <Frame display="flex"> and give it there.',
  },
  {
    applies: ({ tag, name }) => TEXT_ATTRIBUTES.has(name) && tag !== "Text",
    message: ({ tag, name }) => `${name} styles a text: a <${tag}> holds none.`,
    hint: () => "Give it on the <Text> inside.",
  },
  {
    applies: ({ tag, name }) => tag === "Text" && BOX_PAINT.has(name),
    message: ({ name }) => `A <Text> has no box to paint: ${name} is not written on it.`,
    hint: ({ name }) =>
      name === "background"
        ? "A text's colour is color; a background goes on a <Frame> around it."
        : name === "box-shadow"
          ? "A text's shadow is text-shadow."
          : "Put the text in a <Frame> and give it there.",
  },
  {
    applies: ({ tag, name }) =>
      (tag === "Line" || tag === "Group") &&
      BOX_PAINT.has(name) &&
      // A line is drawn by its border; it has no corners to round.
      !(tag === "Line" && name.startsWith("border") && name !== "border-radius"),
    message: ({ tag, name }) => `A <${tag}> has no ${name}.`,
    hint: ({ tag }) =>
      tag === "Line" ? "A line is drawn by its border-top (or border-left when it stands)." : "Paint its layers.",
  },
  {
    applies: ({ tag, name }) => name === "overflow" && SHAPE_TAGS.has(tag),
    message: ({ tag }) => `A <${tag}> holds no layers to clip.`,
    hint: () => "overflow clips a frame's content.",
  },
];
