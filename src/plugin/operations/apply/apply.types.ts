import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import type { Counterparts } from "@/plugin/operations/apply/counterparts.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

/** A layer that holds layers in an order: where a new or moved one goes. */
export type Holder = BaseNode & ChildrenMixin;

/** Where a layer goes: a parent and the index among its children. */
export interface Place {
  readonly parent: Holder;
  readonly index: number;
}

/** One call: dry or real, its changes, where top-level layers go, the layers by ref, the failed ones, the copies' layers. */
export interface ApplyCall {
  readonly dry: boolean;
  readonly changes: readonly ApplyChangeData[];
  readonly top: BaseNode;
  readonly layers: Map<string, TypedLayer>;
  /** The new layers whose creation failed, by ref: a child names its parent from here. */
  readonly failed: Map<string, ApplyChangeData>;
  readonly counterparts: Counterparts;
}
