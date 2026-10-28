import { injectable } from "@needle-di/core";
import { LINK_STATE } from "@/plugin-ui/link/socket-link/socket-link.constants.ts";
import type { LinkState } from "@/plugin-ui/link/socket-link/socket-link.types.ts";
import {
  NOT_A_DIGIT,
  PAIRING_NOTE,
  STATUS_TEXT,
  TONE,
  WINDOW_ELEMENT,
  WINDOW_ERROR,
  WINDOW_EVENT,
} from "@/plugin-ui/view/plugin-window/plugin-window.constants.ts";
import type { StatusLine, WindowParts } from "@/plugin-ui/view/plugin-window/plugin-window.types.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { PAIRING_CODE_DIGITS } from "@/shared/protocol/protocol.constants.ts";

/**
 * The plugin's small window (P-041): the status line, and the pairing field while the server waits for the code. The
 * markup is ui.html's own; the window sets only texts, so nothing from the file is ever read as HTML.
 */
@injectable()
export class PluginWindow {
  #parts: WindowParts | null = null;

  /** Finds ui.html's elements, and sends a typed code to `onPair` once it has its six digits. */
  mount(onPair: (code: string) => void): void {
    const parts: WindowParts = {
      dot: this.#element(WINDOW_ELEMENT.dot),
      title: this.#element(WINDOW_ELEMENT.title),
      detail: this.#element(WINDOW_ELEMENT.detail),
      pairing: this.#element(WINDOW_ELEMENT.pairing) as HTMLFormElement,
      code: this.#element(WINDOW_ELEMENT.code) as HTMLInputElement,
      note: this.#element(WINDOW_ELEMENT.pairingNote),
    };

    this.#element(WINDOW_ELEMENT.brand).textContent = CHANNEL.pluginName;
    parts.pairing.addEventListener(WINDOW_EVENT.submit, (event) => {
      const code = parts.code.value.replace(NOT_A_DIGIT, "");

      event.preventDefault();

      if (code.length === PAIRING_CODE_DIGITS) {
        onPair(code);
        parts.code.value = "";
      }
    });
    this.#parts = parts;
  }

  render(
    state: LinkState,
    fileName: string,
  ): void {
    const parts = this.#parts;
    const line = this.#line(state, fileName);

    if (parts === null) {
      return;
    }

    parts.dot.dataset.tone = line.tone;
    parts.title.textContent = line.title;
    parts.detail.textContent = line.detail ?? "";
    parts.detail.hidden = line.detail === null;
    parts.pairing.hidden = line.note === null;
    parts.note.textContent = line.note ?? "";
    parts.note.hidden = line.note === null;
  }

  /** The window's file tab is in front. */
  visible(): boolean {
    return document.visibilityState === WINDOW_EVENT.visible;
  }

  #line(
    state: LinkState,
    fileName: string,
  ): StatusLine {
    switch (state.kind) {
      case LINK_STATE.connected:
        return {
          tone: TONE.ok,
          title: STATUS_TEXT.connected(fileName),
          detail: STATUS_TEXT.seesFile,
          note: null,
        };
      case LINK_STATE.pairing:
        return {
          tone: TONE.wait,
          title: STATUS_TEXT.pairing,
          detail: null,
          note: PAIRING_NOTE[state.reason](state.attemptsLeft),
        };
      case LINK_STATE.waiting:
        return {
          tone: TONE.wait,
          title: STATUS_TEXT.notConnected,
          detail: state.reason ?? STATUS_TEXT.startServer,
          note: null,
        };
      case LINK_STATE.stopped:
        return {
          tone: TONE.error,
          title: STATUS_TEXT.stopped,
          detail: state.reason,
          note: null,
        };
      default:
        return {
          tone: TONE.wait,
          title: STATUS_TEXT.connecting,
          detail: STATUS_TEXT.lookingForServer,
          note: null,
        };
    }
  }

  #element(id: string): HTMLElement {
    const element = document.getElementById(id);

    if (element === null) {
      throw new Error(WINDOW_ERROR.missing(id));
    }

    return element;
  }
}
