import { InjectionToken, injectable } from "@needle-di/core";
import { LINK_STATE } from "@/plugin-ui/link/link.constants.ts";
import type { LinkState } from "@/plugin-ui/link/socket-link.ts";
import { EDITS_TEXT, PAIRING_NOTE, STATUS_TEXT, TONE } from "@/plugin-ui/view/view.constants.ts";

/**
 * The window's words for its state (P-050, P-053, P-012): the link in a word and a sentence, the line under the code
 * field while pairing, the note under the Allow edits switch and the hint above it. What the AI may do with the file is
 * the switch's to say.
 */
@injectable()
export class StatusLine {
  /** An op still running past its answer takes the sentence, its dot waiting (A§15.10). */
  line(
    state: LinkState,
    fileName: string,
    busy: string | null,
  ): StatusWords {
    const line = this.#link(state, fileName);

    return busy === null ? line : { ...line, tone: line.tone === TONE.ok ? TONE.wait : line.tone, detail: busy };
  }

  /**
   * Under the switch: how long it stays on and how a change is taken back, or that the AI only reads; and that code
   * execute started runs on until the window closes, whatever the switch says.
   */
  editsNote(
    on: boolean,
    ranCode: boolean,
    undo: string,
  ): string {
    if (on) {
      return EDITS_TEXT.on(undo);
    }

    return ranCode ? EDITS_TEXT.offWhileCodeRuns : EDITS_TEXT.off;
  }

  /** Above the switch after the AI tried to write while it was off; null otherwise. */
  editsHint(refused: boolean, on: boolean): string | null {
    return refused && !on ? EDITS_TEXT.refused : null;
  }

  #link(state: LinkState, fileName: string): StatusWords {
    switch (state.kind) {
      case LINK_STATE.connected:
        return { tone: TONE.ok, title: STATUS_TEXT.connected(fileName), detail: STATUS_TEXT.seesFile, note: null };
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
        return { tone: TONE.error, title: STATUS_TEXT.stopped, detail: state.reason, note: null };
      default:
        return { tone: TONE.wait, title: STATUS_TEXT.connecting, detail: STATUS_TEXT.lookingForServer, note: null };
    }
  }
}

export const STATUS_LINE = new InjectionToken<StatusLine>("StatusLine");

/** The connection in a word and a sentence, and the line under the code field while the server waits for a code. */
export interface StatusWords {
  readonly tone: (typeof TONE)[keyof typeof TONE];
  readonly title: string;
  readonly detail: string | null;
  readonly note: string | null;
}
