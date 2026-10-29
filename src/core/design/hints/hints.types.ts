import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

/** A layer the read shows as a layer, with the parent it sits in. */
export interface ShownLayer {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
}

/** What a hint looks at on a layer: the layer, its parent, the read's root and the layer's shown children. */
export interface LayerScope extends ShownLayer {
  readonly root: ReadLayer;
  readonly children: readonly ReadLayer[];
}

/** A kind of hint about layers: the example a layer gives of it (null for none), and the hint for all of them. */
export interface HintKind {
  readonly find: (scope: LayerScope) => string | null;
  readonly say: (examples: readonly string[]) => string;
}
