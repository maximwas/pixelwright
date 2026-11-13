import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import type { Refusal } from "@/plugin/operations/apply/checks.ts";
import type { Counterparts } from "@/plugin/operations/apply/counterparts.ts";
import type { ApplyReport } from "@/plugin/operations/apply/report.ts";
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

/** A held set's variant's change that waits for the set: what places the variant in it (a grid cell, its alignment). */
interface Placing {
  readonly node: SceneNode;
  readonly change: ApplyChangeData;
  readonly refusals: readonly Refusal[];
}

/** A new set waiting for its variants: the frame holding them until they are combined, and their placing in it. */
export interface PendingSet {
  readonly change: ApplyChangeData;
  readonly holder: SceneNode;
  readonly refusals: Refusal[];
  readonly placing: Placing[];
}

/** One call's state: the call's, with its report and the sets still held. */
export interface Run extends ApplyCall {
  readonly report: ApplyReport;
  readonly sets: PendingSet[];
}
