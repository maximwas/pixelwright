import type { Container } from "@needle-di/core";
import { BASELINE_DIFF, BaselineDiff } from "@/core/diff/baseline/baseline-diff.ts";
import { LAYER_CHANGES, LayerChanges } from "@/core/diff/baseline/layer-changes.ts";
import { STRUCTURE_CHANGES, StructureChanges } from "@/core/diff/baseline/structure-changes.ts";
import { TOKEN_CHANGES, TokenChanges } from "@/core/diff/baseline/token-changes.ts";
import { BASELINE_CAPTURE, BaselineCapture } from "@/server/app/baselines/baseline-capture.ts";
import { BASELINE_STORE, BaselineStore } from "@/server/app/baselines/baseline-store.ts";
import { SEEN_DESIGNS, SeenDesigns } from "@/server/app/baselines/seen-designs.ts";
import { BASELINE_COMPARE, BaselineCompare } from "@/server/tools/baseline-diff/baseline-compare.ts";
import { BASELINE_OVERVIEW, BaselineOverview } from "@/server/tools/baseline-diff/baseline-overview.ts";
import { BASELINE_ROOT, BaselineRoot } from "@/server/tools/baseline-diff/baseline-root.ts";
import { BASELINE_TARGET, BaselineTarget } from "@/server/tools/baseline-diff/baseline-target.ts";
import { BASELINE_KEEPER, BaselineKeeper } from "@/server/tools/baseline-save/baseline-keeper.ts";

/**
 * The baselines' bindings (T-200..T-203): the project's baseline files, the designs diffs compared (one set per server,
 * lost on restart, D-39), the capture both tools read through, baseline_save's keeper, and baseline_diff's core diff,
 * file rule, root finder, comparison and the overview of every baseline.
 */
export class BaselineProviders {
  register(container: Container): void {
    container
      .bind({ provide: BASELINE_STORE, useClass: BaselineStore })
      .bind({ provide: SEEN_DESIGNS, useClass: SeenDesigns })
      .bind({ provide: BASELINE_CAPTURE, useClass: BaselineCapture })
      .bind({ provide: BASELINE_KEEPER, useClass: BaselineKeeper })
      .bind({ provide: LAYER_CHANGES, useClass: LayerChanges })
      .bind({ provide: STRUCTURE_CHANGES, useClass: StructureChanges })
      .bind({ provide: TOKEN_CHANGES, useClass: TokenChanges })
      .bind({ provide: BASELINE_DIFF, useClass: BaselineDiff })
      .bind({ provide: BASELINE_TARGET, useClass: BaselineTarget })
      .bind({ provide: BASELINE_ROOT, useClass: BaselineRoot })
      .bind({ provide: BASELINE_COMPARE, useClass: BaselineCompare })
      .bind({ provide: BASELINE_OVERVIEW, useClass: BaselineOverview });
  }
}
