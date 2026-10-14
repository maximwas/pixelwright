import {
  BridgeError,
  OPERATION_SCHEMAS,
  type OperationInput,
  type OperationName,
  type OperationOutput,
} from "@pixelwright/core";

import { apply } from "./apply.ts";
import { asOwnWrite, changes } from "./changes.ts";
import { components } from "./components.ts";
import { deleteNodes } from "./delete.ts";
import { execute } from "./execute.ts";
import { exportNode, originalImage } from "./export-node.ts";
import { fileMap, flows, screens } from "./flows.ts";
import { inspect } from "./inspect.ts";
import { find, outline, selection, setOf, show, viewport } from "./read-ops.ts";
import { saveVersion } from "./save-version.ts";
import { selectionWait } from "./selection-wait.ts";
import { entries, snapshot } from "./snapshot.ts";
import { tokensApply } from "./tokens-apply.ts";
import { upload } from "./uploads.ts";
import { usage } from "./usage.ts";
import { variables } from "./variables.ts";

type Handlers = { readonly [N in OperationName]: (input: OperationInput<N>) => Promise<OperationOutput<N>> };

/** What the plugin does for each operation the server may ask for; inputs are checked against the shared schemas. */
const HANDLERS: Handlers = {
  ping: async () => ({ pong: true }),
  selection,
  show,
  viewport,
  selection_wait: selectionWait,
  changes,
  flows,
  usage,
  set_of: setOf,
  screens,
  file_map: fileMap,
  find,
  outline,
  export: exportNode,
  image: originalImage,
  snapshot,
  variables,
  components,
  entries,
  apply,
  delete: deleteNodes,
  inspect,
  execute,
  tokens_apply: tokensApply,
  save_version: saveVersion,
  upload,
};

const isOperation = (op: string): op is OperationName => Object.hasOwn(OPERATION_SCHEMAS, op);

/** The operations that change the file. */
const OWN_WRITES: ReadonlySet<OperationName> = new Set(["apply", "delete", "execute", "tokens_apply"]);

export async function runOperation(op: string, input: unknown): Promise<unknown> {
  if (!isOperation(op)) {
    throw new BridgeError("UNKNOWN_OP", `Unknown operation: ${op}`);
  }

  const parsed = OPERATION_SCHEMAS[op].input.safeParse(input);

  if (!parsed.success) {
    throw new BridgeError("OP_FAILED", `${op}: invalid input: ${parsed.error.message}`);
  }

  const run = (): Promise<unknown> => HANDLERS[op](parsed.data as never);

  // A write's own changes are marked as Pixelwright's in the change journal.
  return OWN_WRITES.has(op) ? asOwnWrite(run) : run();
}
