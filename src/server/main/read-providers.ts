import type { Container } from "@needle-di/core";
import { AUTO_LINE_HEIGHTS, AutoLineHeights } from "@/core/css/fonts/auto-line-heights.ts";
import { DESIGN_HINTS, DesignHints } from "@/core/design/hints/design-hints.ts";
import { INFERRED_HINTS, InferredHints } from "@/core/design/hints/inferred-hints.ts";
import { LAYER_HINTS, LayerHints } from "@/core/design/hints/layer-hints.ts";
import { LAYOUT_GUESS, LayoutGuess } from "@/core/design/hints/layout-guess.ts";
import { ALIKE_STRUCTURES, AlikeStructures } from "@/core/design/hints/structure/alike-structures.ts";
import { BAKED_PAINTS, BakedPaints } from "@/core/design/hints/structure/baked-paints.ts";
import { LAYER_SHAPE, LayerShape } from "@/core/design/hints/structure/layer-shape.ts";
import { SHARED_LAYERS, SharedLayers } from "@/core/design/hints/structure/shared-layers.ts";
import { STRUCTURE_HINTS, StructureHints } from "@/core/design/hints/structure/structure-hints.ts";
import { TOKEN_HINTS, TokenHints } from "@/core/design/hints/token-hints.ts";
import { READ_JSON, ReadJson } from "@/core/design/read-json.ts";
import { INSPECT_FILLS, InspectFills } from "@/core/inspect/inspect-fills.ts";
import { INSPECT_VIEW, InspectView } from "@/core/inspect/inspect-view.ts";
import { MEASURE, Measure } from "@/core/inspect/measure.ts";
import { MEASUREMENTS, Measurements } from "@/core/inspect/measurements.ts";

/**
 * What design_read adds beside its XML: the hints, the measurements, Auto line heights in px (T-060, T-061); and the
 * read's other views: inspect's fills and view and measure's engine (T-080, T-081).
 */
export class ReadProviders {
  register(container: Container): void {
    container
      .bind({ provide: LAYOUT_GUESS, useClass: LayoutGuess })
      .bind({ provide: LAYER_SHAPE, useClass: LayerShape })
      .bind({ provide: ALIKE_STRUCTURES, useClass: AlikeStructures })
      .bind({ provide: SHARED_LAYERS, useClass: SharedLayers })
      .bind({ provide: BAKED_PAINTS, useClass: BakedPaints })
      .bind({ provide: STRUCTURE_HINTS, useClass: StructureHints })
      .bind({ provide: LAYER_HINTS, useClass: LayerHints })
      .bind({ provide: TOKEN_HINTS, useClass: TokenHints })
      .bind({ provide: INFERRED_HINTS, useClass: InferredHints })
      .bind({ provide: DESIGN_HINTS, useClass: DesignHints })
      .bind({ provide: MEASUREMENTS, useClass: Measurements })
      .bind({ provide: INSPECT_FILLS, useClass: InspectFills })
      .bind({ provide: INSPECT_VIEW, useClass: InspectView })
      .bind({ provide: MEASURE, useClass: Measure })
      .bind({ provide: READ_JSON, useClass: ReadJson })
      .bind({ provide: AUTO_LINE_HEIGHTS, useClass: AutoLineHeights });
  }
}
