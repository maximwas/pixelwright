import { emit, on, showUI } from "@create-figma-plugin/utilities";
import { SUPPORT_LINKS, toWireError } from "@pixelwright/core";
import { PLUGIN_WINDOW, WINDOW_HEIGHT } from "./constants/plugin.ts";
import { readContext } from "./figma/context.ts";
import { editsAllowed, setEditsAllowed } from "./figma/edits.ts";
import { readEditsAllowed, saveEditsAllowed } from "./figma/edits-store.ts";
import { runOperation } from "./figma/operations.ts";
import { readPairing, savePairing } from "./figma/pairing-store.ts";
import type {
  AllowEditsHandler,
  ContextHandler,
  OpenLinkHandler,
  PairingHandler,
  ReadyHandler,
  RequestHandler,
  ResizeHandler,
  ResponseHandler,
  SavePairingHandler,
} from "./types/messages.ts";

/**
 * The plugin's main code: answers the window's requests with the Plugin API, keeps the Allow edits switch and the
 * paired key. The switch starts off and comes back on only in a file the user left it on in (edits-store.ts); the key
 * is shared by every file on purpose: pairing is once per machine. The window's HTML carries no data: file and page
 * names are the user's, and its inline script would run them, so everything goes by message after READY.
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
    // A file Figma will not let it mark (a view-only one) keeps the switch for this run only.
    void saveEditsAllowed(value).catch(() => {});
  });
  on<SavePairingHandler>("SAVE_PAIRING", (key) => void savePairing(key).catch(() => {}));
  // Only the project's own support links: the window is ours, but an address it passes is still checked.
  on<OpenLinkHandler>("OPEN_LINK", (url) => {
    if (SUPPORT_LINKS.some((link) => link.url === url)) {
      figma.openExternal(url);
    }
  });
  on<ResizeHandler>("RESIZE", (height) =>
    figma.ui.resize(PLUGIN_WINDOW.width, Math.min(Math.max(Math.ceil(height), WINDOW_HEIGHT.min), WINDOW_HEIGHT.max)),
  );
  figma.on("currentpagechange", sendContext);
}

/** The window is listening: first the stored key, then the context it starts the connection with. */
async function start(sendContext: () => void): Promise<void> {
  emit<PairingHandler>("PAIRING", await readPairing().catch(() => null));
  setEditsAllowed(await readEditsAllowed().catch(() => false));
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
