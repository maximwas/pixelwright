import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { UI_EVENT } from "@/plugin/adapters/host/ui-channel/ui-channel.constants.ts";
import { UI_CHANNEL_NAME } from "@/shared/window/ui-message.constants.ts";
import { type UiMessage, UiMessageSchema, type WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * Main's end of figma.ui (Adapter, A§4.3), with its two virtual channels: `server`, the frames the window relays from
 * its socket, and `window`, the window's own messages. A message that is not one of ours is dropped.
 */
@injectable()
export class UiChannel {
  #onWindow: (message: WindowMessage) => void = () => {};

  start(): void {
    figma.ui.on(UI_EVENT.message, (message: unknown) => this.#receive(message));
  }

  onWindow(listener: (message: WindowMessage) => void): void {
    this.#onWindow = listener;
  }

  post(message: UiMessage): void {
    figma.ui.postMessage(message);
  }

  #receive(data: unknown): void {
    const message = zod.safeParse(UiMessageSchema, data);

    // shortcut: server frames have no taker until item 05 attaches ServerRpc to this channel; until then they drop here.
    if (message.success && message.data.ch === UI_CHANNEL_NAME.window) {
      this.#onWindow(message.data.d);
    }
  }
}
