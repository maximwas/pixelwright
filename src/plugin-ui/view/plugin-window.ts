import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LINK_STATE } from "@/plugin-ui/link/link.constants.ts";
import type { LinkState } from "@/plugin-ui/link/socket-link.ts";
import { BUSY_STATE } from "@/plugin-ui/view/busy-state.ts";
import { STATUS_LINE } from "@/plugin-ui/view/status-line.ts";
import {
  MS_PER_SECOND,
  NOT_A_DIGIT,
  SUPPORT_TEXT,
  UNDO_KEY,
  WINDOW_ELEMENT,
  WINDOW_ERROR,
  WINDOW_EVENT,
  WINDOW_TAG,
} from "@/plugin-ui/view/view.constants.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { PAIRING_CODE_DIGITS } from "@/shared/protocol/protocol.constants.ts";
import { ACTIVITY_OUTCOME, FEEDBACK_LINK, SUPPORT_LINKS } from "@/shared/window/ui-message.constants.ts";
import type { ActivityEntry, BusyOp } from "@/shared/window/ui-message.schema.ts";

/**
 * The plugin's small window (P-041, P-050..P-054): its mark, the link's status line, the pairing field while the
 * server waits for the code, the hint after a refused write, the Allow edits switch and its note, and the support and
 * feedback links. The markup and the mark are ui.html's own; the window sets texts and builds plain elements, so
 * nothing from the file or from code is ever read as HTML. It lists nothing the AI did: main's answers only feed the
 * two notes around the switch (a write was refused, execute ran: P-012).
 */
@injectable()
export class PluginWindow {
  readonly #status;
  readonly #busy;
  #parts: WindowParts | null = null;
  #link: LinkState = { kind: LINK_STATE.connecting };
  #fileName = "";
  #allowEdits = false;
  #refused = false;
  #ranCode = false;
  #ticker: ReturnType<typeof setInterval> | undefined;

  constructor(status = inject(STATUS_LINE), busy = inject(BUSY_STATE)) {
    this.#status = status;
    this.#busy = busy;
  }

  /** Finds ui.html's elements and hands what the user does to `handlers`. */
  mount(handlers: WindowHandlers): void {
    const parts = this.#find();

    document.addEventListener(WINDOW_EVENT.visibilityChange, () => handlers.onVisible(this.visible()));
    this.#element(WINDOW_ELEMENT.brand).textContent = CHANNEL.pluginName;
    parts.pairing.addEventListener(WINDOW_EVENT.submit, (event) => {
      const code = parts.code.value.replace(NOT_A_DIGIT, "");

      event.preventDefault();

      if (code.length === PAIRING_CODE_DIGITS) {
        handlers.onPair(code);
        parts.code.value = "";
      }
    });
    parts.edits.addEventListener(WINDOW_EVENT.change, () => this.#switched(parts.edits.checked, handlers));
    this.#links(parts, handlers);
    // The window is as tall as what it shows: the pairing field and the hint come and go (P-002).
    new ResizeObserver(() => handlers.onResize(parts.root.getBoundingClientRect().height)).observe(parts.root);
    this.#parts = parts;
    this.#draw();
  }

  /** The Allow edits switch as main keeps it for this file (P-011). */
  showEdits(on: boolean): void {
    this.#allowEdits = on;
    this.#draw();
  }

  render(state: LinkState, fileName: string): void {
    this.#link = state;
    this.#fileName = fileName;
    this.#draw();
  }

  /** An op main answered: a refusal asks for Allow edits, and execute that was not refused may run on (P-012). */
  activity({ op, outcome }: ActivityEntry): void {
    const refused = outcome === ACTIVITY_OUTCOME.refused;

    this.#refused ||= refused;
    this.#ranCode ||= op === OP_NAME.execute && !refused;
    this.#draw();
  }

  /** What still runs past its answer: the status sentence counts its seconds until nothing does. */
  busy(ops: readonly BusyOp[]): void {
    this.#busy.show(ops);
    clearInterval(this.#ticker);
    this.#ticker = this.#busy.busy() ? setInterval(() => this.#draw(), MS_PER_SECOND) : undefined;
    this.#draw();
  }

  /** The window's file tab is in front. */
  visible(): boolean {
    return document.visibilityState === WINDOW_EVENT.visible;
  }

  #switched(on: boolean, handlers: WindowHandlers): void {
    this.#allowEdits = on;

    if (on) {
      // Allow edits went on: the refusal is answered.
      this.#refused = false;
    }

    handlers.onEdits(on);
    this.#draw();
  }

  #draw(): void {
    const parts = this.#parts;

    if (parts === null) {
      return;
    }

    const line = this.#status.line(this.#link, this.#fileName, this.#busy.line(Date.now()));

    parts.dot.dataset.tone = line.tone;
    parts.title.textContent = line.title;
    this.#text(parts.detail, line.detail);
    parts.pairing.hidden = line.note === null;
    this.#text(parts.note, line.note);
    this.#text(parts.hint, this.#status.editsHint(this.#refused, this.#allowEdits));
    parts.edits.checked = this.#allowEdits;
    parts.editsNote.textContent = this.#status.editsNote(this.#allowEdits, this.#ranCode, this.#undoKey());
  }

  /** A text that may be absent: absent, its element is hidden. */
  #text(element: HTMLElement, text: string | null): void {
    element.textContent = text ?? "";
    element.hidden = text === null;
  }

  /** Where to support the project, its links joined by "or", and where to tell what works or does not (P-052). */
  #links(parts: WindowParts, handlers: WindowHandlers): void {
    const support = SUPPORT_LINKS.flatMap((link, index) => [
      ...(index === 0 ? [] : [SUPPORT_TEXT.or]),
      this.#anchor(link, handlers),
    ]);

    parts.support.replaceChildren(SUPPORT_TEXT.support, ...support, SUPPORT_TEXT.end);
    parts.feedback.replaceChildren(SUPPORT_TEXT.feedback, this.#anchor(FEEDBACK_LINK, handlers), SUPPORT_TEXT.end);
  }

  /** A link main opens in the browser (K-102): the window itself cannot leave Figma. */
  #anchor({ label, url }: LinkTarget, handlers: WindowHandlers): HTMLAnchorElement {
    const anchor = document.createElement(WINDOW_TAG.link);

    anchor.href = url;
    anchor.textContent = label;
    anchor.addEventListener(WINDOW_EVENT.click, (event) => {
      event.preventDefault();
      handlers.onOpenLink(url);
    });

    return anchor;
  }

  /** The undo shortcut of the system Figma runs on. */
  #undoKey(): string {
    return navigator.userAgent.includes(UNDO_KEY.macAgent) ? UNDO_KEY.mac : UNDO_KEY.other;
  }

  #find(): WindowParts {
    return {
      root: this.#element(WINDOW_ELEMENT.root),
      dot: this.#element(WINDOW_ELEMENT.dot),
      title: this.#element(WINDOW_ELEMENT.title),
      detail: this.#element(WINDOW_ELEMENT.detail),
      pairing: this.#element(WINDOW_ELEMENT.pairing) as HTMLFormElement,
      code: this.#element(WINDOW_ELEMENT.code) as HTMLInputElement,
      note: this.#element(WINDOW_ELEMENT.pairingNote),
      hint: this.#element(WINDOW_ELEMENT.hint),
      edits: this.#element(WINDOW_ELEMENT.allowEdits) as HTMLInputElement,
      editsNote: this.#element(WINDOW_ELEMENT.editsNote),
      support: this.#element(WINDOW_ELEMENT.support),
      feedback: this.#element(WINDOW_ELEMENT.feedback),
    };
  }

  #element(id: string): HTMLElement {
    const element = document.getElementById(id);

    if (element === null) {
      throw new Error(WINDOW_ERROR.missing(id));
    }

    return element;
  }
}

export const PLUGIN_WINDOW = new InjectionToken<PluginWindow>("PluginWindow");

/** What the user does in the window, for its link to pass on. */
export interface WindowHandlers {
  /** A code the user typed, once it has its six digits. */
  readonly onPair: (code: string) => void;
  readonly onEdits: (on: boolean) => void;
  /** Whether the window's tab is in front, each time that changes. */
  readonly onVisible: (on: boolean) => void;
  readonly onOpenLink: (url: string) => void;
  /** The height of what the window shows, each time it changes. */
  readonly onResize: (height: number) => void;
}

/** A link the window shows, from the shared constants main checks it against. */
interface LinkTarget {
  readonly label: string;
  readonly url: string;
}

/** ui.html's elements the window fills in. */
interface WindowParts {
  readonly root: HTMLElement;
  readonly dot: HTMLElement;
  readonly title: HTMLElement;
  readonly detail: HTMLElement;
  readonly pairing: HTMLFormElement;
  readonly code: HTMLInputElement;
  readonly note: HTMLElement;
  readonly hint: HTMLElement;
  readonly edits: HTMLInputElement;
  readonly editsNote: HTMLElement;
  readonly support: HTMLElement;
  readonly feedback: HTMLElement;
}
