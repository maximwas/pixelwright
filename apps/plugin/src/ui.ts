import { emit, on } from "@create-figma-plugin/utilities";
import type { PluginInfo, RequestMessage } from "@pixelwright/core";
import { BRIDGE_URL, RECENT_ACTIONS } from "./constants/plugin.ts";
import { newInstanceId } from "./link/instance-id.ts";
import { SocketLink } from "./link/socket-link.ts";
import type { LinkState, RequestOutcome } from "./types/link.ts";
import type {
  AllowEditsHandler,
  ContextHandler,
  PluginContext,
  RequestHandler,
  ResponseHandler,
} from "./types/messages.ts";
import type { RecentAction } from "./types/window.ts";
import { createPluginWindow } from "./view/plugin-window.ts";

/** The UI iframe: holds the bridge socket (only the iframe may use the network) and draws the window. */
export default function (root: HTMLElement, initial: PluginContext): void {
  const instanceId = newInstanceId();
  const pending = new Map<string, (outcome: RequestOutcome) => void>();
  let context = initial;
  let link: LinkState = { kind: "connecting" };
  let actions: readonly RecentAction[] = [];
  const view = createPluginWindow(root, { onAllowEdits: (value) => emit<AllowEditsHandler>("ALLOW_EDITS", value) });
  const render = () =>
    view.render({
      context,
      link,
      actions,
    });
  const info = (): PluginInfo => ({
    instanceId,
    ...context,
    visible: document.visibilityState === "visible",
  });
  const socket = new SocketLink({
    url: BRIDGE_URL,
    info,
    onRequest: (request: RequestMessage) =>
      new Promise<RequestOutcome>((resolve) => {
        pending.set(request.id, resolve);
        actions = [
          {
            op: request.op,
            at: Date.now(),
          },
          ...actions,
        ].slice(0, RECENT_ACTIONS);
        render();
        emit<RequestHandler>("REQUEST", request.id, request.op, request.input ?? null);
      }),
    onState: (state) => {
      link = state;
      render();
    },
  });

  on<ResponseHandler>("RESPONSE", (id, outcome) => {
    pending.get(id)?.(outcome);
    pending.delete(id);
  });
  on<ContextHandler>("CONTEXT", (next) => {
    context = next;
    socket.sendInfo();
    render();
  });
  document.addEventListener("visibilitychange", () => socket.sendInfo());
  render();
  socket.start();
}
