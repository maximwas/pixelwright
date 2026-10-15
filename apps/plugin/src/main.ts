import { emit, on, showUI } from "@create-figma-plugin/utilities";
import { FEEDBACK_LINK, SUPPORT_LINKS, toWireError } from "@pixelwright/core";
import { PLUGIN_WINDOW, WINDOW_HEIGHT } from "./constants/plugin.ts";
import { readContext } from "./figma/context.ts";
import { readPairing, savePairing } from "./figma/pairing-store.ts";
import { OperationRegistry } from "./operations/registry.ts";
import { EditsStore } from "./services/edits-store.ts";
import { createServices, type PluginServices } from "./services/plugin-services.ts";
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
 * The plugin's main code, its composition root: answers the window's requests with the Plugin API, keeps the Allow
 * edits switch and the paired key. The switch starts off and comes back on only in a file the user left it on in
 * (EditsStore); the key is shared by every file on purpose: pairing is once per machine. The window's HTML carries no
 * data: file and page names are the user's, and its inline script would run them, so everything goes by message after
 * READY.
 */
export default function (): void {
  const services = createServices();
  const registry = new OperationRegistry(services);
  const store = new EditsStore();
  const sendContext = () => emit<ContextHandler>("CONTEXT", readContext(services.edits.allowed));

  showUI(PLUGIN_WINDOW);
  // What the user changes from now on, for changes_since.
  services.journal.start();
  on<ReadyHandler>("READY", () => void start(services, store, sendContext));
  on<RequestHandler>("REQUEST", (id, op, input) => void answer(registry, id, op, input));
  on<AllowEditsHandler>("ALLOW_EDITS", (value) => {
    services.edits.allow(value);
    sendContext();
    // A file Figma will not let it mark (a view-only one) keeps the switch for this run only.
    void store.save(value).catch(() => {});
  });
  on<SavePairingHandler>("SAVE_PAIRING", (key) => void savePairing(key).catch(() => {}));
  // Only the project's own support and feedback links: the window is ours, but an address it passes is still checked.
  on<OpenLinkHandler>("OPEN_LINK", (url) => {
    if ([...SUPPORT_LINKS, FEEDBACK_LINK].some((link) => link.url === url)) {
      figma.openExternal(url);
    }
  });
  on<ResizeHandler>("RESIZE", (height) =>
    figma.ui.resize(PLUGIN_WINDOW.width, Math.min(Math.max(Math.ceil(height), WINDOW_HEIGHT.min), WINDOW_HEIGHT.max)),
  );
  figma.on("currentpagechange", sendContext);
}

/** The window is listening: first the stored key, then the context it starts the connection with. */
async function start(services: PluginServices, store: EditsStore, sendContext: () => void): Promise<void> {
  emit<PairingHandler>("PAIRING", await readPairing().catch(() => null));
  services.edits.allow(await store.read().catch(() => false));
  sendContext();
}

async function answer(registry: OperationRegistry, id: string, op: string, input: unknown): Promise<void> {
  try {
    emit<ResponseHandler>("RESPONSE", id, {
      ok: true,
      result: await registry.run(op, input),
    });
  } catch (error) {
    emit<ResponseHandler>("RESPONSE", id, {
      ok: false,
      error: toWireError(error),
    });
  }
}
