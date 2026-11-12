import { FEEDBACK_LINK, SUPPORT_LINKS, type SupportLink } from "@pixelwright/core";
import { MARK_SVG } from "../constants/plugin.ts";
import type { RecentAction, WindowState } from "../types/window.ts";
import { element } from "./dom.ts";
import { editsHint, editsNote, pairingNote, statusLine } from "./status-line.ts";
import { WINDOW_CSS } from "./styles.ts";
import { UpdateBannerView } from "./update-banner-view.ts";

export interface WindowHandlers {
  readonly onAllowEdits: (allowEdits: boolean) => void;
  /** The user typed the pairing code and pressed Pair (or Enter). */
  readonly onPair: (code: string) => void;
  /** The user clicked a support, feedback or update link: main opens it in the browser. */
  readonly onOpenLink: (url: string) => void;
  /** The user closed the update banner of this version. */
  readonly onDismissUpdate: (version: string) => void;
}

/** The undo shortcut of the system Figma runs on. */
const UNDO = navigator.userAgent.includes("Mac") ? "⌘Z" : "Ctrl+Z";

/**
 * The plugin's small window: its mark, the connection and what it lets the AI do, the pairing field while the server
 * waits for the code, the Allow edits switch, what the AI did last, where to support the project and where to tell what
 * works or does not. Built once, re-rendered in place.
 */
export class PluginWindow {
  readonly #dot = element("span", "dot");
  readonly #title = element("strong", "title");
  readonly #detail = element("p", "detail");
  readonly #pairing = element("form", "pairing");
  readonly #pairingText = element("p", "note");
  readonly #hint = element("p", "hint");
  readonly #toggle = document.createElement("input");
  readonly #note = element("p", "note");
  readonly #actions = element("ul", "actions");
  readonly #update = new UpdateBannerView();

  constructor(root: HTMLElement, { onAllowEdits, onPair, onOpenLink, onDismissUpdate }: WindowHandlers) {
    const style = document.createElement("style");

    style.textContent = WINDOW_CSS;
    this.#hint.setAttribute("role", "alert");
    root.append(
      style,
      this.#update.mount(onOpenLink, onDismissUpdate),
      brand(),
      this.#status(),
      this.#pairingForm(onPair),
      this.#pairingText,
      this.#hint,
      this.#edits(onAllowEdits),
      this.#activity(),
      supportLine(onOpenLink),
      feedbackLine(onOpenLink),
    );
  }

  render({ context, link, actions, refused, ranCode, update }: WindowState): void {
    const line = statusLine(link, context.file.name);
    const pairingLine = pairingNote(link);
    const hintLine = editsHint(refused, context.allowEdits);

    this.#dot.dataset.tone = line.tone;
    this.#title.textContent = line.title;
    this.#detail.textContent = line.detail ?? "";
    this.#detail.hidden = line.detail === null;
    this.#pairing.hidden = pairingLine === null;
    this.#pairingText.hidden = pairingLine === null;
    this.#pairingText.textContent = pairingLine ?? "";
    this.#hint.hidden = hintLine === null;
    this.#hint.textContent = hintLine ?? "";
    this.#toggle.checked = context.allowEdits;
    this.#note.textContent = editsNote(context.allowEdits, UNDO, ranCode);
    this.#actions.replaceChildren(...activityItems(actions));
    this.#update.render(update);
  }

  #status(): HTMLElement {
    return element("div", "status", this.#dot, element("div", "words", this.#title, this.#detail));
  }

  /** The pairing code's field: six digits, sent on Pair or Enter, then cleared. */
  #pairingForm(onPair: (code: string) => void): HTMLFormElement {
    const codeField = document.createElement("input");
    const pairButton = document.createElement("button");

    codeField.inputMode = "numeric";
    codeField.maxLength = 6;
    codeField.autocomplete = "one-time-code";
    codeField.placeholder = "000000";
    codeField.setAttribute("aria-label", "Pairing code");
    pairButton.type = "submit";
    pairButton.textContent = "Pair";
    this.#pairing.append(codeField, pairButton);
    this.#pairing.addEventListener("submit", (event) => {
      event.preventDefault();

      const code = codeField.value.replace(/\D/g, "");

      if (code.length === 6) {
        onPair(code);
        codeField.value = "";
      }
    });

    return this.#pairing;
  }

  /** The Allow edits switch and what it means now. */
  #edits(onAllowEdits: (allowEdits: boolean) => void): HTMLElement {
    this.#toggle.type = "checkbox";
    this.#toggle.setAttribute("role", "switch");
    this.#toggle.addEventListener("change", () => onAllowEdits(this.#toggle.checked));

    return element("section", "edits", element("label", "toggle", "Allow edits", this.#toggle), this.#note);
  }

  #activity(): HTMLElement {
    return element("section", "activity", element("h2", "heading", "Activity"), this.#actions);
  }
}

/** The window's mark and name. */
function brand(): HTMLElement {
  const mark = element("span", "mark");

  // A constant of ours, never the file's data.
  mark.innerHTML = MARK_SVG;

  return element("header", "brand", mark, element("strong", "brand-name", "Pixelwright"));
}

/** Where to support the project: its links, joined by "or". */
function supportLine(onOpenLink: (url: string) => void): HTMLElement {
  const support = element("p", "support", "Pixelwright is free. Support it on ");

  for (const [index, link] of SUPPORT_LINKS.entries()) {
    support.append(index === 0 ? "" : " or ", anchor(link, onOpenLink));
  }

  support.append(".");

  return support;
}

/** Where to tell what works or does not. */
function feedbackLine(onOpenLink: (url: string) => void): HTMLElement {
  return element("p", "support", "Ideas or a bug? Tell us on ", anchor(FEEDBACK_LINK, onOpenLink), ".");
}

/** A link main opens in the browser: the window itself cannot leave Figma. */
function anchor({ label, url }: SupportLink, onOpenLink: (url: string) => void): HTMLAnchorElement {
  const link = element("a", "", label);

  link.href = url;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    onOpenLink(url);
  });

  return link;
}

/** What the AI did last, newest first, each with its time; a line saying so when it did nothing yet. */
function activityItems(actions: readonly RecentAction[]): HTMLLIElement[] {
  if (actions.length === 0) {
    return [element("li", "empty", "Nothing yet")];
  }

  return actions.map((action) =>
    element(
      "li",
      action.warning ? "warning" : "",
      element("span", "what", action.text),
      element(
        "span",
        "when",
        new Date(action.at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    ),
  );
}
