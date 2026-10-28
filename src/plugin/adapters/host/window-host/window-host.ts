import { inject, injectable } from "@needle-di/core";
import { EDITS_SWITCH } from "@/core/ports/edits-switch/edits-switch.port.ts";
import { PAIRING_STORE } from "@/plugin/adapters/host/pairing-store/pairing-store.tokens.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { VERSION } from "@/shared/version/version.constants.ts";
import { UI_CHANNEL_NAME, WINDOW_MESSAGE } from "@/shared/window/ui-message.constants.ts";
import type { PluginContext, WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * Main's side of the window channel (P-001, P-007): when the window says ready, it hands over the stored key and the
 * file's context by message, never through showUI, whose data would run as the window's script (FX-001); a key a
 * pairing issued is stored in place of the old one, and the Allow edits switch is kept per file.
 */
@injectable()
export class WindowHost {
  readonly #channel;
  readonly #pairing;
  readonly #edits;

  constructor(
    channel = inject(UI_CHANNEL),
    pairing = inject(PAIRING_STORE),
    edits = inject(EDITS_SWITCH),
  ) {
    this.#channel = channel;
    this.#pairing = pairing;
    this.#edits = edits;
  }

  start(): void {
    this.#channel.onWindow((message) => void this.#take(message));
    this.#channel.start();
  }

  async #take(message: WindowMessage): Promise<void> {
    if (message.type === WINDOW_MESSAGE.ready) {
      this.#channel.post({
        ch: UI_CHANNEL_NAME.window,
        d: {
          type: WINDOW_MESSAGE.start,
          key: await this.#pairing.read(),
          context: await this.#context(),
        },
      });
    } else if (message.type === WINDOW_MESSAGE.savePairing) {
      // A key Figma would not keep is asked for again on the next run: nothing is lost but one more code.
      await this.#pairing.save(message.key).catch(() => undefined);
    } else if (message.type === WINDOW_MESSAGE.allowEdits) {
      await this.#edits.set(message.on);
    }
  }

  /** The file and page this window runs in; figma.fileKey is given to private plugins only (P-003). */
  async #context(): Promise<PluginContext> {
    return {
      pluginVersion: VERSION,
      editorType: figma.editorType,
      file: {
        name: figma.root.name,
        key: figma.fileKey ?? null,
      },
      page: {
        id: figma.currentPage.id,
        name: figma.currentPage.name,
      },
      allowEdits: await this.#edits.isOn(),
    };
  }
}
