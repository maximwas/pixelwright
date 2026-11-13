import type { ComponentOwner } from "@/plugin/adapters/figma/components/components.types.ts";
import type { ComponentEntry } from "@/shared/ops/components/components.schema.ts";
import type { PageNotRead } from "@/shared/ops/file-map/file-map.schema.ts";

/**
 * What one components walk found, by the listed id: the entries, their nodes, one instance of each used one (a library
 * component's links are read there), the pages Figma could not load, whether the deadline cut it, and the deadline.
 */
export interface FoundComponents {
  readonly entries: ReadonlyMap<string, ComponentEntry>;
  readonly owners: ReadonlyMap<string, ComponentOwner>;
  readonly instances: ReadonlyMap<string, InstanceNode>;
  readonly notRead: readonly PageNotRead[];
  readonly cut: boolean;
  readonly deadline: number;
}
