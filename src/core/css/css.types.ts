import type { CssDeclarations } from "@/core/css/registry/css-declarations.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/** What a group reads a layer with: the layer, its parent (how it sits; null for the read's root), the read, the CSS. */
export interface CssScope {
  readonly layer: ReadLayer;
  readonly parent: ReadLayer | null;
  readonly model: ReadModel;
  readonly css: CssDeclarations;
}

/**
 * One group of the mapping table (C-172): the CSS attributes it owns (no other group writes them), the read-model fields
 * they come from (so an error names the attribute's source), and its read; its write comes with design_apply.
 */
export interface PropertyGroup {
  readonly attributes: readonly string[];
  readonly sources: readonly string[];
  read(scope: CssScope): void;
}
