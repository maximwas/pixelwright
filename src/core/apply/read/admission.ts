import { APPLY_PATTERN, APPLY_TAG, CREATABLE_TAGS, KNOWN_TAGS, UNDRAWN_TAGS } from "@/core/apply/apply.constants.ts";
import type { ElementNode } from "@/core/apply/apply.types.ts";
import {
  ADMISSION_ACTION,
  ADMISSION_TEXT,
  type AdmissionAction,
  ICON_EXTENSION,
} from "@/core/apply/read/read.constants.ts";
import type { ReadScope } from "@/core/apply/read/read-scope.ts";
import type { Closest } from "@/core/kernel/names/closest.ts";
import { TAG } from "@/core/xml/tags.constants.ts";

/**
 * What happens to an element that is not read: skipped (its children with ids still read, new ones not created), or
 * refused (its children read as if it were made, so new ones fail where it does).
 */
export interface AdmissionRefusal {
  readonly action: AdmissionAction;
  readonly message: string;
  readonly hint?: string;
}

/** An element as admission sees it: its node and scope, the id it names, and what that id stands for. */
export interface Candidate {
  readonly node: ElementNode;
  readonly scope: ReadScope;
  /** The id the element gives. */
  readonly named: string | null;
  /** Inside a copy or a new instance: the layer the id names there (the source's); else null. */
  readonly source: string | null;
  /** The layer the element changes: its id outside a copy; null for a create or inside a copy. */
  readonly id: string | null;
  /** The ids taken so far where the element is: the call's, or its copy's. */
  readonly seen: Set<string>;
}

type Missing = { readonly message: string; readonly hint?: string };

/**
 * C-161: whether an element is read, the checks in their order (the order is the spec, golden cases name the winner):
 * a new element under a parent that was not made, a stray Span, an unknown tag, a Page inside a layer, an id that is no
 * Figma id, a copy with an id, an id given twice (the id is taken once this passes), and what a new layer of its tag
 * cannot be made without. Null admits it.
 */
export class Admission {
  readonly #closest: Closest;

  constructor(closest: Closest) {
    this.#closest = closest;
  }

  of(candidate: Candidate): AdmissionRefusal | null {
    return (
      this.#notCreated(candidate) ??
      this.#spanOutsideText(candidate) ??
      this.#unknownTag(candidate) ??
      this.#pageInLayer(candidate) ??
      this.#notLayerId(candidate) ??
      this.#copyWithId(candidate) ??
      this.#givenTwice(candidate) ??
      this.#createRequirements(candidate)
    );
  }

  /** A new layer under a new parent that was not made; a layer the element names (a copy's counterpart too) still reads. */
  #notCreated({ node, scope, named }: Candidate): AdmissionRefusal | null {
    const parent = scope.skippedParent;

    return parent !== null && named === null && parent.props.id === undefined
      ? { action: ADMISSION_ACTION.skip, message: ADMISSION_TEXT.notCreated(node.type, parent.type, parent.line) }
      : null;
  }

  #spanOutsideText({ node }: Candidate): AdmissionRefusal | null {
    return node.type === APPLY_TAG.span
      ? { action: ADMISSION_ACTION.skip, message: ADMISSION_TEXT.spanOutsideText }
      : null;
  }

  #unknownTag({ node }: Candidate): AdmissionRefusal | null {
    if (KNOWN_TAGS.has(node.type)) {
      return null;
    }

    const near = this.#closest.of(node.type, KNOWN_TAGS);

    return {
      action: ADMISSION_ACTION.refuse,
      message: ADMISSION_TEXT.notPixelwrightTag(node.type),
      hint: near === null ? ADMISSION_TEXT.tagsHint : ADMISSION_TEXT.tagNear(near),
    };
  }

  #pageInLayer({ node, scope }: Candidate): AdmissionRefusal | null {
    return node.type === TAG.PAGE && (scope.parentRef !== null || scope.skippedParent !== null || scope.copy !== null)
      ? { action: ADMISSION_ACTION.skip, message: ADMISSION_TEXT.pageInLayer }
      : null;
  }

  #notLayerId({ named }: Candidate): AdmissionRefusal | null {
    return named !== null && !APPLY_PATTERN.layerId.test(named)
      ? { action: ADMISSION_ACTION.skip, message: ADMISSION_TEXT.notLayerId(named) }
      : null;
  }

  #copyWithId({ node, named }: Candidate): AdmissionRefusal | null {
    return named !== null && node.props.copyOf !== undefined
      ? { action: ADMISSION_ACTION.skip, message: ADMISSION_TEXT.copyWithId(named) }
      : null;
  }

  /** An id given twice where it counts (the call, or one copy); one that passes is taken. */
  #givenTwice({ named, source, seen }: Candidate): AdmissionRefusal | null {
    if (named === null) {
      return null;
    }

    if (seen.has(named)) {
      return {
        action: ADMISSION_ACTION.skip,
        message: source === null ? ADMISSION_TEXT.givenTwice(named) : ADMISSION_TEXT.namedTwice(named),
      };
    }

    seen.add(named);

    return null;
  }

  #createRequirements({ node, id, source }: Candidate): AdmissionRefusal | null {
    const missing = id === null && source === null ? this.#missingFor(node) : null;

    return missing === null ? null : { action: ADMISSION_ACTION.refuse, ...missing };
  }

  /** C-162: what a new layer of this tag cannot be made without; null when it has it or is a copy. */
  #missingFor(node: ElementNode): Missing | null {
    if (node.props.copyOf !== undefined) {
      return null;
    }

    if (!CREATABLE_TAGS.has(node.type)) {
      return this.#uncreatable(node.type);
    }

    if (node.type === TAG.INSTANCE && node.props.component === undefined) {
      return { message: ADMISSION_TEXT.instanceNeedsComponent, hint: ADMISSION_TEXT.instanceHint };
    }

    if (node.type === TAG.TEXT_PATH && node.props.d === undefined && node.props.arc === undefined) {
      return { message: ADMISSION_TEXT.textPathNeedsPath, hint: ADMISSION_TEXT.textPathHint };
    }

    if ((node.type === APPLY_TAG.image || node.type === APPLY_TAG.icon) && node.props.src === undefined) {
      return {
        message: ADMISSION_TEXT.needsSrc(node.type),
        hint: ADMISSION_TEXT.srcHint(node.type === APPLY_TAG.icon ? ICON_EXTENSION.icon : ICON_EXTENSION.image),
      };
    }

    return null;
  }

  /** Why a tag that design_apply does not create cannot be: a group, a drawing, or any other. */
  #uncreatable(tag: string): Missing {
    if (tag === TAG.GROUP) {
      return { message: ADMISSION_TEXT.groupMessage, hint: ADMISSION_TEXT.groupHint };
    }

    return UNDRAWN_TAGS.has(tag)
      ? { message: ADMISSION_TEXT.undrawn(tag), hint: ADMISSION_TEXT.undrawnHint }
      : { message: ADMISSION_TEXT.uncreatable(tag) };
  }
}
