import type { Container } from "@needle-di/core";
import { ASSESSOR, Assessor } from "@/core/apply/plan/assessor.ts";
import { CHANGE_OF, ChangeOf } from "@/core/apply/plan/change-of.ts";
import { LAYER_READS, LayerReads } from "@/core/apply/plan/layer-reads.ts";
import { LAYER_RENDERS, LayerRenders } from "@/core/apply/plan/layer-renders.ts";
import { PLACED_LAYERS, PlacedLayers } from "@/core/apply/plan/placed-layers.ts";
import { UNCHANGED, Unchanged } from "@/core/apply/plan/unchanged.ts";
import { WRITE_PLANNER, WritePlanner } from "@/core/apply/plan/write-planner.ts";
import { FONT_VALUES, FontValues } from "@/core/css/fonts/font-values.ts";
import { AppearanceWriter } from "@/core/css/groups/appearance/appearance-writer.ts";
import { EffectsWriter } from "@/core/css/groups/effects/effects-writer.ts";
import { ElementWriter } from "@/core/css/groups/element/element-writer.ts";
import { GridCellWriter } from "@/core/css/groups/geometry/grid-cell-writer.ts";
import { PlacementWriter } from "@/core/css/groups/geometry/placement-writer.ts";
import { SizeWriter } from "@/core/css/groups/geometry/size-writer.ts";
import { TransformWriter } from "@/core/css/groups/geometry/transform-writer.ts";
import { GAP_READER, GapReader } from "@/core/css/groups/layout/gap-reader.ts";
import { GRID_WRITER, GridWriter } from "@/core/css/groups/layout/grid-writer.ts";
import { LayoutWriter } from "@/core/css/groups/layout/layout-writer.ts";
import { FILLS_WRITER, FillsWriter } from "@/core/css/groups/paint/fills-writer.ts";
import { StrokesWriter } from "@/core/css/groups/paint/strokes-writer.ts";
import { TextWriter } from "@/core/css/groups/text/text-writer.ts";
import { PAINT_VALUE, PaintValue } from "@/core/css/paints/paint-value.ts";
import { PROPERTY_WRITERS, WRITE_REGISTRY, WriteRegistry } from "@/core/css/registry/write-registry.ts";

/**
 * What design_apply plans with (A§6.2 step 3): the write halves in 0.7.0's table order (element, layout, geometry,
 * appearance, paint, effects, text: the order a change's properties come in) and the one planner over them.
 */
export class ApplyProviders {
  register(container: Container): void {
    container
      .bind({ provide: GAP_READER, useClass: GapReader })
      .bind({ provide: GRID_WRITER, useClass: GridWriter })
      .bind({ provide: PAINT_VALUE, useClass: PaintValue })
      .bind({ provide: FONT_VALUES, useClass: FontValues })
      .bind({ provide: FILLS_WRITER, useClass: FillsWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: ElementWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: LayoutWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: PlacementWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: SizeWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: GridCellWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: TransformWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: AppearanceWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: FillsWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: StrokesWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: EffectsWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: TextWriter })
      .bind({ provide: WRITE_REGISTRY, useClass: WriteRegistry })
      .bind({ provide: LAYER_READS, useClass: LayerReads })
      .bind({ provide: LAYER_RENDERS, useClass: LayerRenders })
      .bind({ provide: UNCHANGED, useClass: Unchanged })
      .bind({ provide: ASSESSOR, useClass: Assessor })
      .bind({ provide: CHANGE_OF, useClass: ChangeOf })
      .bind({ provide: PLACED_LAYERS, useClass: PlacedLayers })
      .bind({ provide: WRITE_PLANNER, useClass: WritePlanner });
  }
}
