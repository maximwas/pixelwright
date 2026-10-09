import { emit, on } from "@create-figma-plugin/utilities";
import type { PluginInfo, PluginKey, RequestMessage } from "@pixelwright/core";
import { BRIDGE_URL } from "./constants/plugin.ts";
import { newInstanceId } from "./link/instance-id.ts";
import { MainRelay } from "./link/main-relay.ts";
import { SocketLink } from "./link/socket-link.ts";
import type { LinkState, RequestOutcome } from "./types/link.ts";
import type {
  AllowEditsHandler,
  ContextHandler,
  PairingHandler,
  PluginContext,
  ReadyHandler,
  RequestHandler,
  ResponseHandler,
  SavePairingHandler,
} from "./types/messages.ts";
import type { RecentAction } from "./types/window.ts";
import { createPluginWindow } from "./view/plugin-window.ts";
import { withAction } from "./view/recent-actions.ts";

/**
 * The UI iframe: holds the bridge socket (only the iframe may use the network) and draws the window. It starts with no
 * data, says READY, gets the stored key and the file's context by message, and only then connects.
 */
export default function (root: HTMLElement): void {
  const instanceId = newInstanceId();
  const relay = new MainRelay((id, op, input) => emit<RequestHandler>("REQUEST", id, op, input));
  let storedKey: PluginKey | null = null;
  let context: PluginContext | null = null;
  let link: LinkState = { kind: "connecting" };
  let actions: readonly RecentAction[] = [];
  let socket: SocketLink | null = null;
  const view = createPluginWindow(root, {
    onAllowEdits: (value) => emit<AllowEditsHandler>("ALLOW_EDITS", value),
    onPair: (code) => socket?.pair(code),
  });
  const render = () => {
    if (context !== null) {
      view.render({
        context,
        link,
        actions,
      });
    }
  };
  const info = (current: PluginContext): PluginInfo => ({
    instanceId,
    ...current,
    visible: document.visibilityState === "visible",
  });
  const connect = (current: PluginContext): SocketLink =>
    new SocketLink({
      url: BRIDGE_URL,
      info: () => info(context ?? current),
      key: storedKey,
      onRequest: (request: RequestMessage): Promise<RequestOutcome> => {
        actions = withAction(actions, request.op, Date.now());
        render();

        return relay.call(request.op, request.input ?? null);
      },
      onState: (state) => {
        link = state;
        render();
      },
      onPaired: (key) => emit<SavePairingHandler>("SAVE_PAIRING", key),
    });

  on<ResponseHandler>("RESPONSE", (id, outcome) => relay.settle(id, outcome));
  on<PairingHandler>("PAIRING", (key) => {
    storedKey = key;
  });
  on<ContextHandler>("CONTEXT", (next) => {
    context = next;
    render();

    if (socket === null) {
      socket = connect(next);
      socket.start();
    } else {
      socket.sendInfo();
    }
  });
  document.addEventListener("visibilitychange", () => socket?.sendInfo());
  emit<ReadyHandler>("READY");
}
