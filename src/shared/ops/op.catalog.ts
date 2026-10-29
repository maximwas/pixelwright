import { changesOp } from "@/shared/ops/changes/changes.manifest.ts";
import { executeOp } from "@/shared/ops/execute/execute.manifest.ts";
import { OpCatalog } from "@/shared/ops/op-catalog.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import { selectionOp } from "@/shared/ops/selection/selection.manifest.ts";
import { selectionWaitOp } from "@/shared/ops/selection-wait/selection-wait.manifest.ts";
import { showOp } from "@/shared/ops/show/show.manifest.ts";
import { viewportOp } from "@/shared/ops/viewport/viewport.manifest.ts";

/** The ops this build has, in the golden's order (test/golden/operations.golden.test.ts). */
export const OP_CONTRACTS = new OpCatalog([
  pingOp,
  selectionOp,
  changesOp,
  executeOp,
  showOp,
  viewportOp,
  selectionWaitOp,
]);
