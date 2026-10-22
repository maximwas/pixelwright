import type { XmlElementNode } from "../../types/xml.ts";
import { closest } from "../../utils/closest.ts";
import { CREATABLE_TAGS, KNOWN_TAGS, LAYER_ID, UNDRAWN_TAGS } from "../vocabulary.ts";
import type { Scope } from "./scope.ts";

/**
 * What happens to an element that is not read: skipped (its children with ids still read, new ones not created), or
 * refused (its children read as if it were made, so new ones fail where it does).
 */
export interface Admission {
  readonly action: "skip" | "refuse";
  readonly message: string;
  readonly hint?: string;
}

/** An element as admission sees it: its node and scope, the id it names, and what that id stands for. */
export interface Candidate {
  readonly node: XmlElementNode;
  readonly scope: Scope;
  /** The id the element gives. */
  readonly named: string | null;
  /** Inside a copy or a new instance: the layer the id names there (the source's); else null. */
  readonly source: string | null;
  /** The layer the element changes: its id outside a copy; null for a create or inside a copy. */
  readonly id: string | null;
  /** The ids taken so far where the element is: the call's, or its copy's. */
  readonly seen: Set<string>;
}

type Check = (candidate: Candidate) => Admission | null;

/**
 * Whether an element is read, the checks in their order: a new element under a parent that was not made, a stray
 * Span, an unknown tag, a Page inside a layer, an id that is no Figma id, a copy with an id, an id given twice (the id is taken once this
 * passes), and what a new layer of its tag cannot be made without. Null admits it.
 */
export function admissionOf(candidate: Candidate): Admission | null {
  for (const check of CHECKS) {
    const admission = check(candidate);

    if (admission !== null) {
      return admission;
    }
  }

  return null;
}

/** A new layer under a new parent that was not made; a layer the element names (a copy's counterpart too) still reads. */
const notCreated: Check = ({ node, scope, named }) =>
  scope.skippedParent !== null && named === null && scope.skippedParent.props.id === undefined
    ? {
        action: "skip",
        message: `<${node.type}> is not created: its parent <${scope.skippedParent.type}> at line ${scope.skippedParent.line} was not applied.`,
      }
    : null;

const spanOutsideText: Check = ({ node }) =>
  node.type === "Span"
    ? {
        action: "skip",
        message: "A <Span> belongs inside a Text: it is a run of the text's characters.",
      }
    : null;

const unknownTag: Check = ({ node }) => {
  if (KNOWN_TAGS.has(node.type)) {
    return null;
  }

  const near = closest(node.type, KNOWN_TAGS);

  return {
    action: "refuse",
    message: `<${node.type}> is not a Pixelwright tag.`,
    hint: near === null ? "Tags are Figma layer types: Frame, Text, Rectangle…" : `Did you mean <${near}>?`,
  };
};

const pageInLayer: Check = ({ node, scope }) =>
  node.type === "Page" && (scope.parentRef !== null || scope.skippedParent !== null || scope.copy !== null)
    ? {
        action: "skip",
        message: "A <Page> stands at the top level: a page holds layers, and no layer holds a page.",
      }
    : null;

const notLayerId: Check = ({ named }) =>
  named !== null && !LAYER_ID.test(named)
    ? {
        action: "skip",
        message: `id="${named}" is not a Figma layer id (like 54:243): a new layer has no id.`,
      }
    : null;

const copyWithId: Check = ({ node, named }) =>
  named !== null && node.props.copyOf !== undefined
    ? {
        action: "skip",
        message: `A copy is a new layer: an element with copyOf has no id (${named}).`,
      }
    : null;

/** An id given twice where it counts (the call, or one copy); one that passes is taken. */
const givenTwice: Check = ({ named, source, seen }) => {
  if (named === null) {
    return null;
  }

  if (seen.has(named)) {
    return {
      action: "skip",
      message:
        source === null
          ? `id ${named} is given twice: a new layer has no id, so copy an element without its ids.`
          : `${named} is named twice in one copy: each of the source's layers has one element.`,
    };
  }

  seen.add(named);

  return null;
};

const createRequirements: Check = ({ node, id, source }) => {
  const missing = id === null && source === null ? missingFor(node) : null;

  return missing === null
    ? null
    : {
        action: "refuse",
        ...missing,
      };
};

const CHECKS: readonly Check[] = [
  notCreated,
  spanOutsideText,
  unknownTag,
  pageInLayer,
  notLayerId,
  copyWithId,
  givenTwice,
  createRequirements,
];

/** What a new layer of this tag cannot be made without; null when it has it or is a copy. */
function missingFor(node: XmlElementNode): { message: string; hint?: string } | null {
  if (node.props.copyOf !== undefined) {
    return null;
  }

  if (!CREATABLE_TAGS.has(node.type)) {
    return uncreatable(node.type);
  }

  if (node.type === "Instance" && node.props.component === undefined) {
    return {
      message: "An <Instance> is made from a component.",
      hint: 'Give component="Name" and variant="Property=Value"; components_read lists them.',
    };
  }

  if (node.type === "TextPath" && node.props.d === undefined && node.props.arc === undefined) {
    return {
      message: "A <TextPath> is made along a path: give it d or arc.",
      hint: 'd="M 0 100 C 50 0 150 0 200 100" in its own box, or arc="200 200 150 -60 60" (centre, radius, from and to degrees) in its parent.',
    };
  }

  if ((node.type === "Image" || node.type === "Icon") && node.props.src === undefined) {
    return {
      message: `An <${node.type}> is made from a file: give it src.`,
      hint: `Give src="path/to/file${node.type === "Icon" ? ".svg" : ".png"}".`,
    };
  }

  return null;
}

/** Why a tag that design_apply does not create cannot be: a group, a drawing, or any other. */
function uncreatable(tag: string): { message: string; hint?: string } {
  if (tag === "Group") {
    return {
      message: "A group is made by grouping layers in Figma.",
      hint: "Create a <Frame> instead, or change the group by its id.",
    };
  }

  return UNDRAWN_TAGS.has(tag)
    ? {
        message: `A <${tag}> is not drawn from XML.`,
        hint: 'Draw it as an <Icon src="…svg">, or change it by its id.',
      }
    : { message: `<${tag}> cannot be created.` };
}
