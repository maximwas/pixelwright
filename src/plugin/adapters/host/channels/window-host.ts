import { InjectionToken, inject, injectable } from "@needle-di/core";
import { DOCUMENT_EVENTS } from "@/core/ports/document-events.port.ts";
import { EDITS_SWITCH } from "@/core/ports/edits-switch.port.ts";
import type { WindowEvents } from "@/core/ports/window-events.port.ts";
import { WINDOW_SIZE } from "@/plugin/adapters/host/channels/channels.constants.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/channels/ui-channel.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/storage/pairing-store.ts";
import { FEEDBACK_LINK, SUPPORT_LINKS, UI_CHANNEL_NAME, WINDOW_MESSAGE } from "@/shared/window/ui-message.constants.ts";
import type { ActivityEntry, BusyOp, WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * Main's side of the window channel (P-001, P-007): when the window says ready, it hands over the stored key and the
 * file's context by message, never through showUI, whose data would run as the window's script (FX-001); a key a
 * pairing issued is stored in place of the old one, the Allow edits switch is kept per file, and the switch and the
 * window's tab are file events (S-012). It tells the window each op's answer and what still runs past its answer
 * (P-051, D-06), opens only Pixelwright's own links (K-102), and fits the window to its content (P-002).
 */
@injectable()
export class WindowHost implements WindowEvents {
  readonly #channel;
  readonly #pairing;
  readonly #edits;
  readonly #events;
  readonly #links: ReadonlySet<string> = new Set([...SUPPORT_LINKS, FEEDBACK_LINK].map((link) => link.url));

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

  activity(entry: ActivityEntry): void {
    this.#toWindow({ type: WINDOW_MESSAGE.activity, entry });
  }

  busy(ops: readonly BusyOp[]): void {
    this.#toWindow({ type: WINDOW_MESSAGE.busy, ops: [...ops] });
  }

  async #take(message: WindowMessage): Promise<void> {
    switch (message.type) {
      case WINDOW_MESSAGE.ready:
        this.#toWindow({
          type: WINDOW_MESSAGE.start,
          key: await this.#pairing.read(),
          context: await this.#events.context(),
        });
        break;
      case WINDOW_MESSAGE.savePairing:
        // A key Figma would not keep is asked for again on the next run: nothing is lost but one more code.
        await this.#pairing.save(message.key).catch(() => undefined);
        break;
      case WINDOW_MESSAGE.allowEdits:
        await this.#edits.set(message.on);
        this.#events.changed();
        break;
      case WINDOW_MESSAGE.visible:
        this.#events.visible(message.on);
        break;
      case WINDOW_MESSAGE.openLink:
        this.#open(message.url);
        break;
      case WINDOW_MESSAGE.resize:
        figma.ui.resize(WINDOW_SIZE.width, this.#height(message.height));
        break;
    }
  }

  /** The window asks; an address that is not one of ours stays shut, whoever posted it. */
  #open(url: string): void {
    if (this.#links.has(url)) {
      figma.openExternal(url);
    }
  }

  #height(content: number): number {
    return Math.min(Math.max(Math.ceil(content), WINDOW_SIZE.minHeight), WINDOW_SIZE.maxHeight);
  }

  #toWindow(message: WindowMessage): void {
    this.#channel.post({ ch: UI_CHANNEL_NAME.window, d: message });
  }
}

export const WINDOW_HOST = new InjectionToken<WindowHost>("WindowHost");
