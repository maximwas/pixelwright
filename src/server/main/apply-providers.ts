import type { Container } from "@needle-di/core";
import { ASSESSOR, Assessor } from "@/core/apply/plan/assessor.ts";
import { CHANGE_OF, ChangeOf } from "@/core/apply/plan/change-of.ts";
import { LAYER_READS, LayerReads } from "@/core/apply/plan/layer-reads.ts";
import { PLACED_LAYERS, PlacedLayers } from "@/core/apply/plan/placed-layers.ts";
import { UNCHANGED, Unchanged } from "@/core/apply/plan/unchanged.ts";
import { WRITE_PLANNER, WritePlanner } from "@/core/apply/plan/write-planner.ts";
import { GAP_READER, GapReader } from "@/core/css/groups/layout/gap-reader.ts";
import { GRID_WRITER, GridWriter } from "@/core/css/groups/layout/grid-writer.ts";
import { LayoutWriter } from "@/core/css/groups/layout/layout-writer.ts";
import { PROPERTY_WRITERS, WRITE_REGISTRY, WriteRegistry } from "@/core/css/registry/write-registry.ts";

/** What design_apply plans with (A§6.2 step 3): the write halves of the mapping table and the one planner over them. */
export class ApplyProviders {
  register(container: Container): void {
    container
      .bind({ provide: GAP_READER, useClass: GapReader })
      .bind({ provide: GRID_WRITER, useClass: GridWriter })
      .bind({ provide: PROPERTY_WRITERS, multi: true, useClass: LayoutWriter })
      .bind({ provide: WRITE_REGISTRY, useClass: WriteRegistry })
      .bind({ provide: LAYER_READS, useClass: LayerReads })
      .bind({ provide: UNCHANGED, useClass: Unchanged })
      .bind({ provide: ASSESSOR, useClass: Assessor })
      .bind({ provide: CHANGE_OF, useClass: ChangeOf })
      .bind({ provide: PLACED_LAYERS, useClass: PlacedLayers })
      .bind({ provide: WRITE_PLANNER, useClass: WritePlanner });
  }
}
