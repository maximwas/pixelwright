import type { XmlElementNode } from "../../types/xml.ts";

/** Where an element sits while reading: its parent, a copy it is in, a new component it is in. */
export interface Scope {
  /** The parent element's ref, applied. */
  readonly parentRef: string | null;
  /** A parent that was not applied: an existing one (with id) still holds layers, a new one holds nothing. */
  readonly skippedParent: XmlElementNode | null;
  /**
   * Inside a copy (copyOf) or a new instance: its ref, and the layers named there so far, each once; ids there name
   * the source's layers (or another instance's of the component), written onto their counterparts.
   */
  readonly copy: { readonly ref: string; readonly seen: Set<string> } | null;
  /** Inside a new Component: its layers may make properties (prop, visibleProp). */
  readonly inComponent: boolean;
}

export const TOP: Scope = {
  parentRef: null,
  skippedParent: null,
  copy: null,
  inComponent: false,
};

/** An applied element's children: under it, in a copy it starts (copyOf or a new instance), in a new component. */
export function childScope(
  scope: Scope,
  parent: { readonly ref: string; readonly tag: string; readonly creating: boolean; readonly copying: boolean },
): Scope {
  return {
    parentRef: parent.ref,
    skippedParent: null,
    // A copy's or a new instance's ids are its own layers' counterparts.
    copy:
      parent.copying || (parent.creating && parent.tag === "Instance")
        ? {
            ref: parent.ref,
            seen: new Set(),
          }
        : scope.copy,
    inComponent: scope.inComponent || (parent.creating && parent.tag === "Component"),
  };
}

/** A skipped element's children: those with ids are layers of their own; new ones would land in the wrong layer. */
export function skippedScope(scope: Scope, node: XmlElementNode): Scope {
  return {
    ...scope,
    parentRef: null,
    skippedParent: {
      ...node,
      props: Object.fromEntries(Object.entries(node.props).filter(([name]) => name !== "id")),
    },
  };
}

/** A refused element's children: those with ids are layers of their own; new ones need it made first. */
export function refusedScope(scope: Scope, node: XmlElementNode, id: string | null): Scope {
  return {
    ...scope,
    parentRef: id,
    skippedParent: node,
  };
}
