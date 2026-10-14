import type { SnapshotNode } from "@pixelwright/core";
import { propertyName } from "./names.ts";
import type { PropertyReads } from "./property-reads.ts";

/** Fields an instance overrides that make its properties the outer instance's to say. */
const OVERRIDING: ReadonlySet<string> = new Set(["componentProperties", "mainComponent"]);

/** A getEnum call of a render, named as unread names properties, with the component whose options it maps. */
export interface EnumUse {
  /** `State` on the instance itself, `Button.State` on a nested one. */
  readonly property: string;
  /** The set's or component's id, whose variant options the mapping should name. */
  readonly owner: string;
  /** The property's name as Figma shows it. */
  readonly name: string;
  readonly mapped: readonly string[];
}

/** What one instance's code left out: the properties it never read, and its getEnum calls. */
export interface Coverage {
  readonly unread: string[];
  readonly enums: EnumUse[];
}

/**
 * The properties no code of the render read: the instance's own, and those of the nested instances it exposes or whose
 * properties or component it overrides (`<layer>.<property>`). A text property whose value the snippet holds counts as
 * read, as a template may write it from the text layer instead.
 */
export function coverageOf(node: SnapshotNode, reads: PropertyReads, snippet: string): Coverage {
  const layers = new Map<string, SnapshotNode>();
  const unread = unreadOf(node, "", reads, snippet);

  for (const nested of nestedInstances(node)) {
    layers.set(nested.id, nested);

    if (nested.instance?.exposed || (nested.overrides ?? []).some((field) => OVERRIDING.has(field))) {
      unread.push(...unreadOf(nested, `${nested.name}.`, reads, snippet));
    }
  }

  return {
    unread: [...new Set(unread)],
    enums: reads.enums.flatMap(({ node: id, property, mapped }) => {
      const layer = id === node.id ? node : layers.get(id);
      const instance = layer?.instance;

      return layer === undefined || instance === undefined
        ? []
        : [
            {
              property: layer === node ? property : `${layer.name}.${property}`,
              owner: instance.setId ?? instance.componentId,
              name: property,
              mapped,
            },
          ];
    }),
  };
}

/** An instance's properties no code read, by the names Figma shows, after a prefix. */
function unreadOf(node: SnapshotNode, prefix: string, reads: PropertyReads, snippet: string): string[] {
  return Object.entries(node.instance?.properties ?? {}).flatMap(([key, { type, value }]) => {
    const name = propertyName(key);
    const written = type === "TEXT" && typeof value === "string" && value !== "" && snippet.includes(value);

    return reads.has(node.id, name) || written ? [] : [`${prefix}${name}`];
  });
}

/** The visible instances inside an instance, at any depth, in layer order. */
function nestedInstances(node: SnapshotNode): SnapshotNode[] {
  return (node.children ?? [])
    .filter((child) => child.visible)
    .flatMap((child) => [...(child.type === "INSTANCE" ? [child] : []), ...nestedInstances(child)]);
}
