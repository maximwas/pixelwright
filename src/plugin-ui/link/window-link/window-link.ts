import { inject, injectable } from "@needle-di/core";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { MAIN_CHANNEL } from "@/plugin-ui/adapters/main-channel/main-channel.tokens.ts";
import { SOCKET_LINK } from "@/plugin-ui/link/socket-link/socket-link.tokens.ts";
import type { LinkObserver, LinkState } from "@/plugin-ui/link/socket-link/socket-link.types.ts";
import { INSTANCE_ID_BYTES, WINDOW_LINK_ERROR } from "@/plugin-ui/link/window-link/window-link.constants.ts";
import { PLUGIN_WINDOW } from "@/plugin-ui/view/plugin-window/plugin-window.tokens.ts";
import type { PluginKey } from "@/shared/protocol/handshake.schema.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import { UI_CHANNEL_NAME, WINDOW_MESSAGE } from "@/shared/window/ui-message.constants.ts";
import type { PluginContext, WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * The window's side of the link (Observer of SocketLink): it says ready, connects once main handed over the stored key
 * and the file's context (by message, never through showUI, FX-001), shows each link state, gives main a key a pairing
 * issued, and relays session frames both ways stamped with their socket's epoch.
 */
@injectable()
export class WindowLink implements LinkObserver {
  readonly #channel;
  readonly #link;
  readonly #view;
  #instanceId = "";
  #context: PluginContext | null = null;

  constructor(
    channel = inject(MAIN_CHANNEL),
    link = inject(SOCKET_LINK),
    view = inject(PLUGIN_WINDOW),
  ) {
    this.#channel = channel;
    this.#link = link;
    this.#view = view;
  }

  start(): void {
    this.#instanceId = bytesToHex(randomBytes(INSTANCE_ID_BYTES));
    this.#view.mount((code) => this.#link.pair(code));
    this.#channel.onWindow((message) => this.#take(message));
    this.#channel.onServer((epoch, text) => this.#link.relay(epoch, text));
    this.#channel.start();
    this.#channel.post({
      ch: UI_CHANNEL_NAME.window,
      d: { type: WINDOW_MESSAGE.ready },
    });
  }

  info(): PluginInfo {
    const context = this.#context;

    if (context === null) {
      throw new Error(WINDOW_LINK_ERROR.noContext);
    }

    return {
      instanceId: this.#instanceId,
      ...context,
      visible: this.#view.visible(),
    };
  }

  state(state: LinkState): void {
    this.#view.render(state, this.#context?.file.name ?? "");
  }

  paired(key: PluginKey): void {
    this.#channel.post({
      ch: UI_CHANNEL_NAME.window,
      d: {
        type: WINDOW_MESSAGE.savePairing,
        key,
      },
    });
  }

  frame(
    epoch: number,
    text: string,
  ): void {
    this.#channel.post({
      ch: UI_CHANNEL_NAME.server,
      e: epoch,
      d: text,
    });
  }

  /** Main's answer to ready: the link starts once, with the key and the context it carries. */
  #take(message: WindowMessage): void {
    if (message.type === WINDOW_MESSAGE.start && this.#context === null) {
      this.#context = message.context;
      this.#link.start(message.key, this);
    }
  }
}
