import { InjectionToken, inject, injectable } from "@needle-di/core";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { MAIN_CHANNEL } from "@/plugin-ui/adapters/main-channel.ts";
import { INSTANCE_ID_BYTES, WINDOW_LINK_ERROR } from "@/plugin-ui/link/link.constants.ts";
import { type LinkObserver, type LinkState, SOCKET_LINK } from "@/plugin-ui/link/socket-link.ts";
import { PLUGIN_WINDOW } from "@/plugin-ui/view/plugin-window.ts";
import type { PluginKey } from "@/shared/protocol/handshake.schema.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import { UI_CHANNEL_NAME, WINDOW_MESSAGE } from "@/shared/window/ui-message.constants.ts";
import type { PluginContext, WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * The window's side of the link (listener of SocketLink): it says ready, connects once main handed over the stored key
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
    this.#view.mount(
      (code) => this.#link.pair(code),
      (on) => this.#allowEdits(on),
      (on) => this.#visible(on),
    );
    this.#channel.onWindow((message) => this.#take(message));
    this.#channel.onServer((epoch, text) => this.#link.relay(epoch, text));
    this.#channel.start();
    this.#toMain({ type: WINDOW_MESSAGE.ready });
    this.#visible(this.#view.visible());
  }

  info(): PluginInfo {
    const context = this.#context;

    if (context === null) {
      throw new Error(WINDOW_LINK_ERROR.noContext);
    }

    return { instanceId: this.#instanceId, ...context, visible: this.#view.visible() };
  }

  state(state: LinkState): void {
    this.#view.render(state, this.#context?.file.name ?? "");
  }

  paired(key: PluginKey): void {
    this.#toMain({ type: WINDOW_MESSAGE.savePairing, key });
  }

  frame(epoch: number, text: string): void {
    this.#channel.post({ ch: UI_CHANNEL_NAME.server, e: epoch, d: text });
  }

  /** The switch: main keeps it per file, and the next hello carries it. */
  #allowEdits(on: boolean): void {
    if (this.#context !== null) {
      this.#context = { ...this.#context, allowEdits: on };
    }

    this.#toMain({ type: WINDOW_MESSAGE.allowEdits, on });
  }

  /** Only the window's document knows whether its tab is in front: main hears it for the plugin info (S-012). */
  #visible(on: boolean): void {
    this.#toMain({ type: WINDOW_MESSAGE.visible, on });
  }

  /** Main's answer to ready: the link starts once, with the key and the context it carries. */
  #take(message: WindowMessage): void {
    if (message.type === WINDOW_MESSAGE.start && this.#context === null) {
      this.#context = message.context;
      this.#view.showEdits(message.context.allowEdits);
      this.#link.start(message.key, this);
    }
  }

  #toMain(message: WindowMessage): void {
    this.#channel.post({ ch: UI_CHANNEL_NAME.window, d: message });
  }
}

export const WINDOW_LINK = new InjectionToken<WindowLink>("WindowLink");
