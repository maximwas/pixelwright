import { emit, on, showUI } from "@create-figma-plugin/utilities";
import { toWireError } from "@pixelwright/core";
import { ALLOW_EDITS_KEY, PLUGIN_WINDOW } from "./constants/plugin.ts";
import { readContext } from "./figma/context.ts";
import { runOperation } from "./figma/operations.ts";
import type { AllowEditsHandler, ContextHandler, RequestHandler, ResponseHandler } from "./types/messages.ts";

/** The plugin's main code: answers the UI's requests with the Plugin API and keeps the Allow edits switch. */
export default async function (): Promise<void> {
  const stored: unknown = await figma.clientStorage.getAsync(ALLOW_EDITS_KEY);
  let allowEdits = typeof stored === "boolean" ? stored : false;
  const sendContext = () => emit<ContextHandler>("CONTEXT", readContext(allowEdits));

  showUI(PLUGIN_WINDOW, readContext(allowEdits));
  on<RequestHandler>("REQUEST", (id, op, input) => void answer(id, op, input));
  on<AllowEditsHandler>("ALLOW_EDITS", (value) => {
    allowEdits = value;
    void figma.clientStorage.setAsync(ALLOW_EDITS_KEY, value);
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
