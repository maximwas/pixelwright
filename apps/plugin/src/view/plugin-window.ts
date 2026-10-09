import type { WindowState } from "../types/window.ts";
import { pairingNote, statusLine } from "./status-line.ts";
import { WINDOW_CSS } from "./styles.ts";

interface WindowHandlers {
  readonly onAllowEdits: (allowEdits: boolean) => void;
  /** The user typed the pairing code and pressed Pair (or Enter). */
  readonly onPair: (code: string) => void;
}

/**
 * The plugin's small window: connection, the pairing field while the server waits for the code, the Allow edits switch,
 * the last actions. Built once, re-rendered in place.
 */
export function createPluginWindow(
  root: HTMLElement,
  { onAllowEdits, onPair }: WindowHandlers,
): { render(state: WindowState): void } {
  const style = document.createElement("style");
  const status = document.createElement("div");
  const dot = document.createElement("span");
  const statusText = document.createElement("span");
  const toggleRow = document.createElement("label");
  const toggle = document.createElement("input");
  const note = document.createElement("p");
  const actions = document.createElement("ul");
  const pairing = document.createElement("form");
  const codeField = document.createElement("input");
  const pairButton = document.createElement("button");
  const pairingText = document.createElement("p");

  style.textContent = WINDOW_CSS;
  status.className = "status";
  dot.className = "dot";
  status.append(dot, statusText);
  toggle.type = "checkbox";
  toggle.setAttribute("role", "switch");
  toggle.addEventListener("change", () => onAllowEdits(toggle.checked));
  toggleRow.className = "toggle";
  toggleRow.append("Allow edits", toggle);
  note.className = "note";
  actions.className = "actions";
  pairing.className = "pairing";
  codeField.inputMode = "numeric";
  codeField.maxLength = 6;
  codeField.autocomplete = "one-time-code";
  codeField.placeholder = "000000";
  codeField.setAttribute("aria-label", "Pairing code");
  pairButton.type = "submit";
  pairButton.textContent = "Pair";
  pairingText.className = "note";
  pairing.append(codeField, pairButton);
  pairing.addEventListener("submit", (event) => {
    event.preventDefault();

    const code = codeField.value.replace(/\D/g, "");

    if (code.length === 6) {
      onPair(code);
      codeField.value = "";
    }
  });
  root.append(style, status, pairing, pairingText, toggleRow, note, actions);

  return {
    render({ context, link, actions: recent }) {
      const line = statusLine(link, context.file.name);

      dot.dataset.tone = line.tone;
      statusText.textContent = line.text;

      const pairingLine = pairingNote(link);

      pairing.hidden = pairingLine === null;
      pairingText.hidden = pairingLine === null;
      pairingText.textContent = pairingLine ?? "";
      toggle.checked = context.allowEdits;
      note.textContent = context.allowEdits
        ? "On until this window closes: Pixelwright may change this file, one undo step per change."
        : "Off: Pixelwright only reads this file.";
      actions.replaceChildren(
        ...(recent.length === 0
          ? [item("No actions yet", "")]
          : recent.map((action) => item(action.op, new Date(action.at).toLocaleTimeString()))),
      );
    },
  };
}

function item(name: string, time: string): HTMLLIElement {
  const row = document.createElement("li");
  const label = document.createElement("span");
  const when = document.createElement("span");

  label.textContent = name;
  when.textContent = time;
  row.append(label, when);

  return row;
}
