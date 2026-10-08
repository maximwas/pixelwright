import { emit, on, showUI } from "@create-figma-plugin/utilities";
import { toWireError } from "@pixelwright/core";
import { PLUGIN_WINDOW } from "./constants/plugin.ts";
import { readContext } from "./figma/context.ts";
import { runOperation } from "./figma/operations.ts";
import type {
  AllowEditsHandler,
  ContextHandler,
  ReadyHandler,
  RequestHandler,
  ResponseHandler,
} from "./types/messages.ts";

/**
 * The plugin's main code: answers the window's requests with the Plugin API and keeps the Allow edits switch.
 * The switch starts off on every run: figma.clientStorage is shared by every file, so a stored "on" would arm them all.
 * The window's HTML carries no data: file and page names are the user's, and its inline script would run them, so the
 * context goes by message once the window says it is ready.
 */
export default function (): void {
  let allowEdits = false;
  const sendContext = () => emit<ContextHandler>("CONTEXT", readContext(allowEdits));

  showUI(PLUGIN_WINDOW);
  on<ReadyHandler>("READY", sendContext);
  on<RequestHandler>("REQUEST", (id, op, input) => void answer(id, op, input));
  on<AllowEditsHandler>("ALLOW_EDITS", (value) => {
    allowEdits = value;
    sendContext();
  });
  figma.on("currentpagechange", sendContext);
}

async function answer(id: string, op: string, input: unknown): Promise<void> {
  try {
    emit<ResponseHandler>("RESPONSE", id, {
      ok: true,
      result: await runOperation(op, input),
    });
  } catch (error) {
    emit<ResponseHandler>("RESPONSE", id, {
      ok: false,
      error: toWireError(error),
    });
  }
}
