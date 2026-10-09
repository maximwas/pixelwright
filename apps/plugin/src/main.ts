import { emit, on, showUI } from "@create-figma-plugin/utilities";
import { toWireError } from "@pixelwright/core";
import { PLUGIN_WINDOW, WINDOW_HEIGHT } from "./constants/plugin.ts";
import { readContext } from "./figma/context.ts";
import { editsAllowed, setEditsAllowed } from "./figma/edits.ts";
import { runOperation } from "./figma/operations.ts";
import { readPairing, savePairing } from "./figma/pairing-store.ts";
import type {
  AllowEditsHandler,
  ContextHandler,
  PairingHandler,
  ReadyHandler,
  RequestHandler,
  ResizeHandler,
  ResponseHandler,
  SavePairingHandler,
} from "./types/messages.ts";

/**
 * The plugin's main code: answers the window's requests with the Plugin API, keeps the Allow edits switch and the
 * paired key. The switch starts off on every run: figma.clientStorage is shared by every file, so a stored "on" would
 * arm them all (the key is shared on purpose: pairing is once per machine). The window's HTML carries no data: file
 * and page names are the user's, and its inline script would run them, so everything goes by message after READY.
 */
export default function (): void {
  setEditsAllowed(false);

  const sendContext = () => emit<ContextHandler>("CONTEXT", readContext(editsAllowed()));

  showUI(PLUGIN_WINDOW);
  on<ReadyHandler>("READY", () => void start(sendContext));
  on<RequestHandler>("REQUEST", (id, op, input) => void answer(id, op, input));
  on<AllowEditsHandler>("ALLOW_EDITS", (value) => {
    setEditsAllowed(value);
    sendContext();
  });
  on<SavePairingHandler>("SAVE_PAIRING", (key) => void savePairing(key).catch(() => {}));
  on<ResizeHandler>("RESIZE", (height) =>
    figma.ui.resize(PLUGIN_WINDOW.width, Math.min(Math.max(Math.ceil(height), WINDOW_HEIGHT.min), WINDOW_HEIGHT.max)),
  );
  figma.on("currentpagechange", sendContext);
}

/** The window is listening: first the stored key, then the context it starts the connection with. */
async function start(sendContext: () => void): Promise<void> {
  emit<PairingHandler>("PAIRING", await readPairing().catch(() => null));
  sendContext();
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
