import {
  BridgeError,
  OPERATION_SCHEMAS,
  type OperationInput,
  type OperationName,
  type OperationOutput,
} from "@pixelwright/core";
import type { PluginServices } from "../services/plugin-services.ts";
import { applyChanges } from "./apply/apply-changes.ts";
import { bindTokens } from "./bind/bind-tokens.ts";
import { components } from "./components/read-components.ts";
import { deleteNodes } from "./delete/delete-nodes.ts";
import { applyEffects } from "./effects/apply-effects.ts";
import { execute } from "./execute/execute-code.ts";
import { clipCover } from "./export/clip-cover.ts";
import { exportNode } from "./export/export-node.ts";
import { originalImage } from "./export/original-image.ts";
import { fileMap } from "./flows/file-map.ts";
import { flows } from "./flows/read-flows.ts";
import { screens } from "./flows/screens.ts";
import { saveVersion } from "./history/save-version.ts";
import { inspect } from "./inspect/inspect-layers.ts";
import { find } from "./read/find.ts";
import { outline } from "./read/outline.ts";
import { selection } from "./read/selection.ts";
import { selectionWait } from "./read/selection-wait.ts";
import { setOf } from "./read/set-of.ts";
import { show } from "./read/show.ts";
import { viewport } from "./read/viewport.ts";
import { entries } from "./snapshot/read-entries.ts";
import { snapshot } from "./snapshot/read-snapshot.ts";
import { applyTokens } from "./tokens/apply-tokens.ts";
import { readTokens } from "./tokens/read-tokens.ts";
import { usage } from "./tokens/usage.ts";

type Handlers = {
  readonly [N in OperationName]: (input: OperationInput<N>, services: PluginServices) => Promise<OperationOutput<N>>;
};

/** What the plugin does for each operation the server may ask for, with the services the operation uses. */
const HANDLERS: Handlers = {
  ping: async () => ({ pong: true }),
  selection,
  show,
  viewport,
  selection_wait: selectionWait,
  changes: async (input, { journal }) => journal.changes(input),
  flows,
  usage,
  set_of: setOf,
  screens,
  file_map: fileMap,
  find,
  outline,
  export: (input, services) => exportNode(input, services),
  image: (input, services) => originalImage(input, services),
  snapshot,
  variables: readTokens,
  components,
  entries,
  apply: (input, services) => applyChanges(input, services),
  delete: (input, { edits }) => deleteNodes(input, edits),
  effects: (input, { edits }) => applyEffects(input, edits),
  inspect,
  cover: clipCover,
  execute: (input, { edits }) => execute(input, edits),
  tokens_apply: (input, services) => applyTokens(input, services),
  bind: (input, services) => bindTokens(input, services),
  save_version: (input, services) => saveVersion(input, services),
  upload: async (input, { uploads }) => uploads.receive(input),
};

/** The operations that change the file: their changes are marked as Pixelwright's in the change journal. */
const OWN_WRITES: ReadonlySet<OperationName> = new Set([
  "apply",
  "delete",
  "execute",
  "tokens_apply",
  "effects",
  "bind",
]);

const isOperation = (op: string): op is OperationName => Object.hasOwn(OPERATION_SCHEMAS, op);

/** Runs the operations the server asks for: by name, their input checked against the shared schemas. */
export class OperationRegistry {
  readonly #services: PluginServices;

  constructor(services: PluginServices) {
    this.#services = services;
  }

  async run(op: string, input: unknown): Promise<unknown> {
    if (!isOperation(op)) {
      throw new BridgeError("UNKNOWN_OP", `Unknown operation: ${op}`);
    }

    const parsed = OPERATION_SCHEMAS[op].input.safeParse(input);

    if (!parsed.success) {
      throw new BridgeError("OP_FAILED", `${op}: invalid input: ${parsed.error.message}`);
    }

    const run = (): Promise<unknown> => HANDLERS[op](parsed.data as never, this.#services);

    return OWN_WRITES.has(op) ? this.#services.journal.asOwnWrite(run) : run();
  }
}
