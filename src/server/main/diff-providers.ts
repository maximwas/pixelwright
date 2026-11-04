import type { Container } from "@needle-di/core";
import { BREAKPOINTS_FINDER, Breakpoints } from "@/core/diff/breakpoints.ts";
import { DESIGN_DIFF, DesignDiff } from "@/core/diff/design-diff.ts";
import { FINGERPRINT, Fingerprint } from "@/core/diff/fingerprint.ts";
import { VARIANT_DIFF, VariantDiff } from "@/core/diff/variant-diff.ts";
import { FLOW_LINKS, FlowLinks } from "@/server/tools/flow-read/flow-links.ts";

/** The diffs' bindings: nodes_diff's, variants_read's and breakpoints_find's core/diff, flow_read's links (T-085..T-088). */
export class DiffProviders {
  register(container: Container): void {
    container
      .bind({ provide: FINGERPRINT, useClass: Fingerprint })
      .bind({ provide: DESIGN_DIFF, useClass: DesignDiff })
      .bind({ provide: VARIANT_DIFF, useClass: VariantDiff })
      .bind({ provide: BREAKPOINTS_FINDER, useClass: Breakpoints })
      .bind({ provide: FLOW_LINKS, useClass: FlowLinks });
  }
}
