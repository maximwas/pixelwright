import {
  BridgeError,
  OPERATION_SCHEMAS,
  type OperationInput,
  type OperationName,
  type OperationOutput,
  WRITE_OPERATIONS,
} from "@pixelwright/core";
import type { PluginServices } from "../services/plugin-services.ts";
import { explained } from "../utils/error-message.ts";
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
import { instancesOperation } from "./instances/instances.ts";
import { nearby } from "./nearby/read-nearby.ts";
import { find } from "./read/find.ts";
import { outline } from "./read/outline.ts";
import { selection } from "./read/selection.ts";
import { selectionWait } from "./read/selection-wait.ts";
import { setOf } from "./read/set-of.ts";
import { show } from "./read/show.ts";
import { viewport } from "./read/viewport.ts";
import { entries } from "./snapshot/read-entries.ts";
import { snapshot } from "./snapshot/read-snapshot.ts";
import { replaceTexts } from "./texts/replace-texts.ts";
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
  nearby,
  cover: clipCover,
  execute: (input, { edits, code }) =>
    execute(input, {
      edits,
      code,
    }),
  tokens_apply: (input, services) => applyTokens(input, services),
  bind: (input, services) => bindTokens(input, services),
  texts: (input, services) => replaceTexts(input, services),
  instances: (input, services) => instancesOperation(input, services),
  save_version: (input, services) => saveVersion(input, services),
  upload: async (input, { uploads }) => uploads.receive(input),
};

/**
 * The writes whose changes the change journal marks as Pixelwright's: every one but save_version, which changes no
 * layer and waits for the writes before it to settle (as one of them, it would wait for itself).
 */
const OWN_WRITES: ReadonlySet<string> = new Set([...WRITE_OPERATIONS].filter((op) => op !== "save_version"));

/** What touches no layer runs at once, whatever runs meanwhile: a probe, the journal, an upload, a wait for the user. */
const UNTURNED: ReadonlySet<OperationName> = new Set(["ping", "changes", "upload", "selection_wait"]);

const isOperation = (op: string): op is OperationName => Object.hasOwn(OPERATION_SCHEMAS, op);

/** A write takes its turn alone; so does a render in other variable modes, which has the layer in them meanwhile. */
const isWrite = (op: OperationName, input: unknown): boolean =>
  WRITE_OPERATIONS.has(op) ||
  (op === "export" && Object.keys((input as OperationInput<"export">).modes ?? {}).length > 0);

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

    const handle = (): Promise<unknown> => HANDLERS[op](parsed.data as never, this.#services);
    const run = () => (OWN_WRITES.has(op) ? this.#services.journal.asOwnWrite(handle) : handle());
    const { turns } = this.#services;

    try {
      if (UNTURNED.has(op)) {
        return await run();
      }

      return await (isWrite(op, parsed.data) ? turns.write(run) : turns.read(run));
    } catch (error) {
      throw explained(error);
    }
  }
}
