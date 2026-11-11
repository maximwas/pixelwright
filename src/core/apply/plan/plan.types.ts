import type { ApplyChange, ApplyElement, ApplyError } from "@/core/apply/apply.types.ts";
import type { PlannedComponents } from "@/core/apply/plan/planned-components.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** A layer an element is compared with: the layer, the parent it sits in, the read it came with, the page if it is top level. */
export interface LayerEntry {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
  readonly model: ReadModel;
  readonly page?: string;
}

/** What a layer has now, measured against an element (Unchanged): the writers write only the rest. */
export interface LayerNow {
  /** The element's attributes the layer already has, as design_read writes them: they are not written again. */
  readonly attributes: ReadonlySet<string>;
  /** Whether the layer's text already reads as the element's. */
  readonly text: boolean;
  /** Whether the layer is visible: a hidden one is shown again by a display other than none. */
  readonly visible: boolean;
  /** The layer's attributes as design_read writes them now: they complete what Figma keeps in one property. */
  readonly current: Readonly<Record<string, string>>;
}

/** An element with the layer it is compared with and what that layer holds now; neither for a create. */
export interface Assessment {
  readonly element: ApplyElement;
  readonly entry?: LayerEntry;
  readonly now?: LayerNow;
}

/** What the one planner makes of a call: every change, those the plugin gets, the errors, the components made. */
export interface WritePlan {
  readonly changes: ApplyChange[];
  /** The changes that write something: a layer made, or a property given. */
  readonly written: ApplyChange[];
  /** The changes that write something plus the parents and neighbours of the layers made (C-176). */
  readonly send: ApplyChange[];
  readonly errors: ApplyError[];
  /** By element ref: the CSS attributes no writer handles yet, so a dry run does not read as already as asked. */
  readonly notWritten: ReadonlyMap<string, string[]>;
  readonly components: PlannedComponents;
}
