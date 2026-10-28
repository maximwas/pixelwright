import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/channels/ui-channel.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/storage/pairing-store.ts";
import { UI_CHANNEL_NAME, WINDOW_MESSAGE } from "@/shared/window/ui-message.constants.ts";
import type { WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * Main's side of the window channel (P-001, P-007): when the window says ready, it hands over the stored key and the
 * file's context by message, never through showUI, whose data would run as the window's script (FX-001); a key a
 * pairing issued is stored in place of the old one, the Allow edits switch is kept per file, and the switch and the
 * window's tab are file events (S-012).
 */
@injectable()
export class WindowHost {
  readonly #channel;
  readonly #pairing;
  readonly #edits;
  readonly #events;

  constructor(
    channel = inject(UI_CHANNEL),
    pairing = inject(PAIRING_STORE),
    edits = inject(EDITS_SWITCH),
    events = inject(DOCUMENT_EVENTS),
  ) {
    this.#channel = channel;
    this.#pairing = pairing;
    this.#edits = edits;
    this.#events = events;
  }

  start(): void {
    this.#channel.onWindow((message) => void this.#take(message));
    this.#channel.start();
  }

  async #take(message: WindowMessage): Promise<void> {
    if (message.type === WINDOW_MESSAGE.ready) {
      this.#channel.post({
        ch: UI_CHANNEL_NAME.window,
        d: { type: WINDOW_MESSAGE.start, key: await this.#pairing.read(), context: await this.#events.context() },
      });
    } else if (message.type === WINDOW_MESSAGE.savePairing) {
      // A key Figma would not keep is asked for again on the next run: nothing is lost but one more code.
      await this.#pairing.save(message.key).catch(() => undefined);
    } else if (message.type === WINDOW_MESSAGE.allowEdits) {
      await this.#edits.set(message.on);
      this.#events.changed();
    } else if (message.type === WINDOW_MESSAGE.visible) {
      this.#events.visible(message.on);
    }
  }
}

export const WINDOW_HOST = new InjectionToken<WindowHost>("WindowHost");
