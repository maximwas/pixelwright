import type { WindowState } from "../types/window.ts";
import { statusLine } from "./status-line.ts";
import { WINDOW_CSS } from "./styles.ts";

interface WindowHandlers {
  readonly onAllowEdits: (allowEdits: boolean) => void;
}

/** The plugin's small window: connection, the Allow edits switch, the last actions. Built once, re-rendered in place. */
export function createPluginWindow(
  root: HTMLElement,
  { onAllowEdits }: WindowHandlers,
): { render(state: WindowState): void } {
  const style = document.createElement("style");
  const status = document.createElement("div");
  const dot = document.createElement("span");
  const statusText = document.createElement("span");
  const toggleRow = document.createElement("label");
  const toggle = document.createElement("input");
  const note = document.createElement("p");
  const actions = document.createElement("ul");

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
  root.append(style, status, toggleRow, note, actions);

  return {
    render({ context, link, actions: recent }) {
      const line = statusLine(link, context.file.name);

      dot.dataset.tone = line.tone;
      statusText.textContent = line.text;
      toggle.checked = context.allowEdits;
      note.textContent = context.allowEdits
        ? "On: Pixelwright may change this file. Every change is one undo step."
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
