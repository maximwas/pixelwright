import { injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { FIGMA_UI } from "@/plugin-ui/adapters/main-channel/main-channel.constants.ts";
import { UI_CHANNEL_NAME } from "@/shared/window/ui-message.constants.ts";
import { type UiMessage, UiMessageSchema, type WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * The window's end of figma.ui (Adapter, A§4.4): it posts to main through its parent, and hands each message of main's
 * to the listener of its channel. A message that is not one of ours is dropped.
 */
@injectable()
export class MainChannel {
  #onWindow: (message: WindowMessage) => void = () => {};
  #onServer: (epoch: number, text: string) => void = () => {};

  start(): void {
    window.addEventListener(FIGMA_UI.event, (event: MessageEvent) => this.#receive(event.data?.pluginMessage));
  }

  onWindow(listener: (message: WindowMessage) => void): void {
    this.#onWindow = listener;
  }

  /** Server frames main sends, each stamped with the epoch of the socket it answers. */
  onServer(listener: (epoch: number, text: string) => void): void {
    this.#onServer = listener;
  }

  post(message: UiMessage): void {
    parent.postMessage({ pluginMessage: message }, FIGMA_UI.targetOrigin);
  }

  #receive(data: unknown): void {
    const message = zod.safeParse(UiMessageSchema, data);

    if (!message.success) {
      return;
    }

    if (message.data.ch === UI_CHANNEL_NAME.server) {
      this.#onServer(message.data.e, message.data.d);
    } else {
      this.#onWindow(message.data.d);
    }
  }
}
