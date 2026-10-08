import { emit, on } from "@create-figma-plugin/utilities";
import type { PluginInfo, RequestMessage } from "@pixelwright/core";
import { BRIDGE_URL, RECENT_ACTIONS } from "./constants/plugin.ts";
import { newInstanceId } from "./link/instance-id.ts";
import { MainRelay } from "./link/main-relay.ts";
import { SocketLink } from "./link/socket-link.ts";
import type { LinkState, RequestOutcome } from "./types/link.ts";
import type {
  AllowEditsHandler,
  ContextHandler,
  PluginContext,
  ReadyHandler,
  RequestHandler,
  ResponseHandler,
} from "./types/messages.ts";
import type { RecentAction } from "./types/window.ts";
import { createPluginWindow } from "./view/plugin-window.ts";

/**
 * The UI iframe: holds the bridge socket (only the iframe may use the network) and draws the window. It starts with no
 * data, says READY, and connects once the main code has sent the file's context.
 */
export default function (root: HTMLElement): void {
  const instanceId = newInstanceId();
  const relay = new MainRelay((id, op, input) => emit<RequestHandler>("REQUEST", id, op, input));
  let context: PluginContext | null = null;
  let link: LinkState = { kind: "connecting" };
  let actions: readonly RecentAction[] = [];
  const view = createPluginWindow(root, { onAllowEdits: (value) => emit<AllowEditsHandler>("ALLOW_EDITS", value) });
  const render = () => {
    if (context !== null) {
      view.render({
        context,
        link,
        actions,
      });
    }
  };
  const current = (): PluginContext => {
    if (context === null) {
      throw new Error("The plugin's context has not arrived yet.");
    }

    return context;
  };
  const info = (): PluginInfo => ({
    instanceId,
    ...current(),
    visible: document.visibilityState === "visible",
  });
  const socket = new SocketLink({
    url: BRIDGE_URL,
    info,
    onRequest: (request: RequestMessage): Promise<RequestOutcome> => {
      actions = [
        {
          op: request.op,
          at: Date.now(),
        },
        ...actions,
      ].slice(0, RECENT_ACTIONS);
      render();

      return relay.call(request.op, request.input ?? null);
    },
    onState: (state) => {
      link = state;
      render();
    },
  });

  on<ResponseHandler>("RESPONSE", (id, outcome) => relay.settle(id, outcome));
  on<ContextHandler>("CONTEXT", (next) => {
    const first = context === null;

    context = next;
    render();

    if (first) {
      socket.start();
    } else {
      socket.sendInfo();
    }
  });
  document.addEventListener("visibilitychange", () => socket.sendInfo());
  emit<ReadyHandler>("READY");
}
