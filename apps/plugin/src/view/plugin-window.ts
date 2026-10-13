import { FEEDBACK_LINK, SUPPORT_LINKS, type SupportLink } from "@pixelwright/core";
import { MARK_SVG } from "../constants/plugin.ts";
import type { WindowState } from "../types/window.ts";
import { editsHint, editsNote, pairingNote, statusLine } from "./status-line.ts";
import { WINDOW_CSS } from "./styles.ts";

interface WindowHandlers {
  readonly onAllowEdits: (allowEdits: boolean) => void;
  /** The user typed the pairing code and pressed Pair (or Enter). */
  readonly onPair: (code: string) => void;
  /** The user clicked a support or feedback link: main opens it in the browser. */
  readonly onOpenLink: (url: string) => void;
}

/** The undo shortcut of the system Figma runs on. */
const UNDO = navigator.userAgent.includes("Mac") ? "⌘Z" : "Ctrl+Z";

/**
 * The plugin's small window: its mark, the connection and what it lets the AI do, the pairing field while the server
 * waits for the code, the Allow edits switch, what the AI did last, where to support the project and where to tell what
 * works or does not. Built once, re-rendered in place.
 */
export function createPluginWindow(
  root: HTMLElement,
  { onAllowEdits, onPair, onOpenLink }: WindowHandlers,
): { render(state: WindowState): void } {
  const style = document.createElement("style");
  const brand = element("header", "brand");
  const mark = element("span", "mark");
  const support = element("p", "support", "Pixelwright is free. Support it on ");
  const feedback = element("p", "support", "Ideas or a bug? Tell us on ");
  const status = element("div", "status");
  const dot = element("span", "dot");
  const title = element("strong", "title");
  const detail = element("p", "detail");
  const pairing = element("form", "pairing");
  const codeField = document.createElement("input");
  const pairButton = document.createElement("button");
  const pairingText = element("p", "note");
  const hint = element("p", "hint");
  const edits = element("section", "edits");
  const toggleRow = element("label", "toggle");
  const toggle = document.createElement("input");
  const note = element("p", "note");
  const activity = element("section", "activity");
  const heading = element("h2", "heading");
  const actions = element("ul", "actions");

  style.textContent = WINDOW_CSS;
  // A constant of ours, never the file's data.
  mark.innerHTML = MARK_SVG;
  brand.append(mark, element("strong", "brand-name", "Pixelwright"));

  const anchor = ({ label, url }: SupportLink): HTMLAnchorElement => {
    const link = element("a", "", label);

    link.href = url;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      onOpenLink(url);
    });

    return link;
  };

  for (const [index, link] of SUPPORT_LINKS.entries()) {
    support.append(index === 0 ? "" : " or ", anchor(link));
  }

  support.append(".");
  feedback.append(anchor(FEEDBACK_LINK), ".");
  status.append(dot, element("div", "words", title, detail));
  codeField.inputMode = "numeric";
  codeField.maxLength = 6;
  codeField.autocomplete = "one-time-code";
  codeField.placeholder = "000000";
  codeField.setAttribute("aria-label", "Pairing code");
  pairButton.type = "submit";
  pairButton.textContent = "Pair";
  pairing.append(codeField, pairButton);
  pairing.addEventListener("submit", (event) => {
    event.preventDefault();

    const code = codeField.value.replace(/\D/g, "");

    if (code.length === 6) {
      onPair(code);
      codeField.value = "";
    }
  });
  hint.setAttribute("role", "alert");
  toggle.type = "checkbox";
  toggle.setAttribute("role", "switch");
  toggle.addEventListener("change", () => onAllowEdits(toggle.checked));
  toggleRow.append("Allow edits", toggle);
  edits.append(toggleRow, note);
  heading.textContent = "Activity";
  activity.append(heading, actions);
  root.append(style, brand, status, pairing, pairingText, hint, edits, activity, support, feedback);

  return {
    render({ context, link, actions: recent, refused, ranCode }) {
      const line = statusLine(link, context.file.name);
      const pairingLine = pairingNote(link);
      const hintLine = editsHint(refused, context.allowEdits);

      dot.dataset.tone = line.tone;
      title.textContent = line.title;
      detail.textContent = line.detail ?? "";
      detail.hidden = line.detail === null;
      pairing.hidden = pairingLine === null;
      pairingText.hidden = pairingLine === null;
      pairingText.textContent = pairingLine ?? "";
      hint.hidden = hintLine === null;
      hint.textContent = hintLine ?? "";
      toggle.checked = context.allowEdits;
      note.textContent = editsNote(context.allowEdits, UNDO, ranCode);
      actions.replaceChildren(
        ...(recent.length === 0
          ? [element("li", "empty", "Nothing yet")]
          : recent.map((action) =>
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
            )),
      );
    },
  };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...content: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);

  if (className !== "") {
    made.className = className;
  }

  made.append(...content);

  return made;
}
