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
  OpenLinkHandler,
  PairingHandler,
  PluginContext,
  ReadyHandler,
  RequestHandler,
  ResizeHandler,
  ResponseHandler,
  SavePairingHandler,
} from "./types/messages.ts";
import type { RecentAction } from "./types/window.ts";
import { PluginWindow } from "./view/plugin-window.ts";
import { describeAction, withAction } from "./view/recent-actions.ts";

/**
 * The UI iframe: holds the bridge socket (only the iframe may use the network) and draws the window. It starts with no
 * data, says READY, gets the stored key and the file's context by message, and only then connects.
 */
export default function (root: HTMLElement): void {
  new PluginUi(root).start();
}

/** The iframe's state: the stored key, the file's context, the link, what the AI did, and the socket once it connects. */
class PluginUi {
  readonly #root: HTMLElement;
  readonly #instanceId = newInstanceId();
  readonly #relay = new MainRelay((id, op, input) => emit<RequestHandler>("REQUEST", id, op, input));
  readonly #view: PluginWindow;
  #storedKey: PluginKey | null = null;
  #context: PluginContext | null = null;
  #link: LinkState = { kind: "connecting" };
  #actions: readonly RecentAction[] = [];
  /** A write came while Allow edits was off: the window asks for it until it is on. */
  #refused = false;
  /** execute ran: code it started may outlive the switch until the window closes. */
  #ranCode = false;
  #socket: SocketLink | null = null;

  constructor(root: HTMLElement) {
    this.#root = root;
    this.#view = new PluginWindow(root, {
      onAllowEdits: (value) => emit<AllowEditsHandler>("ALLOW_EDITS", value),
      onPair: (code) => this.#socket?.pair(code),
      onOpenLink: (url) => emit<OpenLinkHandler>("OPEN_LINK", url),
    });
  }

  start(): void {
    on<ResponseHandler>("RESPONSE", (id, outcome) => this.#relay.settle(id, outcome));
    on<PairingHandler>("PAIRING", (key) => {
      this.#storedKey = key;
    });
    on<ContextHandler>("CONTEXT", (next) => this.#contextChanged(next));
    document.addEventListener("visibilitychange", () => this.#socket?.sendInfo());
    // The window is as tall as what it shows: the pairing field and the hint come and go.
    new ResizeObserver(() => emit<ResizeHandler>("RESIZE", this.#root.getBoundingClientRect().height)).observe(
      this.#root,
    );
    emit<ReadyHandler>("READY");
  }

  /** The file's context came (or changed): the window shows it, and the socket connects or tells the server. */
  #contextChanged(next: PluginContext): void {
    this.#context = next;
    this.#refused &&= !next.allowEdits;
    this.#render();

    if (this.#socket === null) {
      this.#socket = this.#connect(next);
      this.#socket.start();
    } else {
      this.#socket.sendInfo();
    }
  }

  #render(): void {
    if (this.#context !== null) {
      this.#view.render({
        context: this.#context,
        link: this.#link,
        actions: this.#actions,
        refused: this.#refused,
        ranCode: this.#ranCode,
      });
    }
  }

  #connect(current: PluginContext): SocketLink {
    return new SocketLink({
      url: BRIDGE_URL,
      info: () => this.#info(this.#context ?? current),
      key: this.#storedKey,
      onRequest: (request) => this.#request(request),
      onState: (state) => {
        this.#link = state;
        this.#render();
      },
      onPaired: (key) => emit<SavePairingHandler>("SAVE_PAIRING", key),
    });
  }

  #info(current: PluginContext): PluginInfo {
    return {
      instanceId: this.#instanceId,
      ...current,
      visible: document.visibilityState === "visible",
    };
  }

  /** A server request, run by main; listed once answered, with what it did. */
  async #request(request: RequestMessage): Promise<RequestOutcome> {
    this.#ranCode ||= request.op === "execute";

    const outcome = await this.#relay.call(request.op, request.input ?? null);
    const line = describeAction(request.op, request.input, outcome);

    if (line !== null) {
      this.#actions = withAction(this.#actions, {
        text: line.text,
        at: Date.now(),
        warning: line.warning,
      });
      this.#refused ||= line.refused;
      this.#render();
    }

    return outcome;
  }
}
