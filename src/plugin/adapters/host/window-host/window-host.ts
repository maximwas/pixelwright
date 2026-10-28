import { inject, injectable } from "@needle-di/core";
import { PAIRING_STORE } from "@/plugin/adapters/host/pairing-store/pairing-store.tokens.ts";
import { UI_CHANNEL } from "@/plugin/adapters/host/ui-channel/ui-channel.tokens.ts";
import { VERSION } from "@/shared/version/version.constants.ts";
import { UI_CHANNEL_NAME, WINDOW_MESSAGE } from "@/shared/window/ui-message.constants.ts";
import type { PluginContext, WindowMessage } from "@/shared/window/ui-message.schema.ts";

/**
 * Main's side of the window channel (P-001, P-007): when the window says ready, it hands over the stored key and the
 * file's context by message, never through showUI, whose data would run as the window's script (FX-001); a key a
 * pairing issued is stored in place of the old one.
 */
@injectable()
export class WindowHost {
  readonly #channel;
  readonly #pairing;

  constructor(
    channel = inject(UI_CHANNEL),
    pairing = inject(PAIRING_STORE),
  ) {
    this.#channel = channel;
    this.#pairing = pairing;
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
          context: this.#context(),
        },
      });
    } else if (message.type === WINDOW_MESSAGE.savePairing) {
      // A key Figma would not keep is asked for again on the next run: nothing is lost but one more code.
      await this.#pairing.save(message.key).catch(() => undefined);
    }
  }

  /** The file and page this window runs in; figma.fileKey is given to private plugins only (P-003). */
  #context(): PluginContext {
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
      // shortcut: Allow edits stays off until item 05 keeps it per file (EditsStore).
      allowEdits: false,
    };
  }
}
