import { ATTRIBUTE } from "@/core/apply/apply.constants.ts";
import type { ElementNode } from "@/core/apply/apply.types.ts";

/** What a scope is made of. */
interface ScopeState {
  readonly parentRef: string | null;
  readonly skippedParent: ElementNode | null;
  readonly copy: { readonly ref: string; readonly seen: Set<string> } | null;
  readonly inComponent: boolean;
}

/** An applied element, as its children's scope sees it. */
export interface ScopeParent {
  readonly ref: string;
  readonly tag: string;
  /** It has no id: a new layer. */
  readonly creating: boolean;
  readonly copying: boolean;
  /** It has an id outside a copy. */
  readonly existing: boolean;
  readonly component: boolean;
  readonly instance: boolean;
}

/** C-166: where an element sits while reading: its parent, a parent not applied, a copy, a component. */
export class ReadScope implements ScopeState {
  /** The parent element's ref, applied. */
  readonly parentRef: string | null;
  /** A parent that was not applied: an existing one (with id) still holds layers, a new one holds nothing. */
  readonly skippedParent: ElementNode | null;
  /**
   * Inside a copy (copyOf) or a new instance: its ref, and the layers named there so far, each once; ids there name
   * the source's layers (or another instance's of the component), written onto their counterparts.
   */
  readonly copy: { readonly ref: string; readonly seen: Set<string> } | null;
  /** Where a component may hold the layers, so they may make its properties (prop, visibleProp, swapProp). */
  readonly inComponent: boolean;

  constructor(state: ScopeState) {
    this.parentRef = state.parentRef;
    this.skippedParent = state.skippedParent;
    this.copy = state.copy;
    this.inComponent = state.inComponent;
  }

  static top(): ReadScope {
    return new ReadScope({ parentRef: null, skippedParent: null, copy: null, inComponent: false });
  }

  /** An applied element's children: under it, in a copy it starts (copyOf or a new instance), in a component. */
  child(parent: ScopeParent): ReadScope {
    return new ReadScope({
      parentRef: parent.ref,
      skippedParent: null,
      // A copy's or a new instance's ids are its own layers' counterparts.
      copy: parent.copying || (parent.creating && parent.instance) ? { ref: parent.ref, seen: new Set() } : this.copy,
      inComponent: this.inComponent || parent.existing || (parent.creating && parent.component),
    });
  }

  /** A skipped element's children: those with ids are layers of their own; new ones would land in the wrong layer. */
  skipped(node: ElementNode): ReadScope {
    return new ReadScope({
      ...this,
      parentRef: null,
      skippedParent: {
        ...node,
        props: Object.fromEntries(Object.entries(node.props).filter(([name]) => name !== ATTRIBUTE.id)),
      },
    });
  }

  /** A refused element's children: those with ids are layers of their own; new ones need it made first. */
  refused(node: ElementNode, id: string | null): ReadScope {
    return new ReadScope({ ...this, parentRef: id, skippedParent: node });
  }
}
