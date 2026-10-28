import { OpCatalog } from "@/shared/ops/op-catalog/op-catalog.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import { selectionOp } from "@/shared/ops/selection/selection.manifest.ts";

/** The ops this build has, in the golden's order (test/golden/operations.golden.test.ts). */
export const OP_CONTRACTS = new OpCatalog([pingOp, selectionOp]);
