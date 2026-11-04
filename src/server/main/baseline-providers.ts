import type { Container } from "@needle-di/core";
import { BASELINE_STORE, BaselineStore } from "@/server/app/stores/baseline-store.ts";
import { SEEN_DESIGNS, SeenDesigns } from "@/server/app/stores/seen-designs.ts";
import { BASELINE_CAPTURE, BaselineCapture } from "@/server/tools/baseline-save/baseline-capture.ts";
import { BASELINE_KEEPER, BaselineKeeper } from "@/server/tools/baseline-save/baseline-keeper.ts";

/**
 * The baselines' bindings (T-200..T-203): the project's baseline files, the designs diffs compared (one set per server,
 * lost on restart, D-39), and baseline_save's capture and keeper.
 */
export class BaselineProviders {
  register(container: Container): void {
    container
      .bind({ provide: BASELINE_STORE, useClass: BaselineStore })
      .bind({ provide: SEEN_DESIGNS, useClass: SeenDesigns })
      .bind({ provide: BASELINE_CAPTURE, useClass: BaselineCapture })
      .bind({ provide: BASELINE_KEEPER, useClass: BaselineKeeper });
  }
}
