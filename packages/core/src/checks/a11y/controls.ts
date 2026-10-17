import { DEFAULT_NAME } from "../../design/hints/layer-hints.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import type { A11yControl } from "./schemas.ts";

/** Roles by the component's name; the kinds before button, which many of them also are. */
const COMPONENT_ROLES: readonly (readonly [RegExp, string])[] = [
  [/\b(checkbox|check ?box)\b/i, "checkbox"],
  [/\bradio\b/i, "radio"],
  [/\b(switch|toggle)\b/i, "switch"],
  [/\btab\b/i, "tab"],
  [/\b(input|text ?field|textarea|text ?area|search ?(field|bar))\b/i, "textbox"],
  [/\b(select|dropdown|combo ?box)\b/i, "combobox"],
  [/\bmenu ?item\b/i, "menuitem"],
  [/\blink\b/i, "link"],
  [/\b(button|btn|cta|icon ?button|chip)\b/i, "button"],
];

/** Roles a component's own name settles, whatever its prototype does. */
const KINDS: ReadonlySet<string> = new Set(["checkbox", "radio", "switch", "tab", "textbox", "combobox", "menuitem"]);

/** Prototype triggers people press. */
const PRESSES: ReadonlySet<string> = new Set(["ON_CLICK", "ON_PRESS", "MOUSE_DOWN", "MOUSE_UP"]);

/** What a pressed layer's prototype does, as a role and why: going to a screen or a URL is a link, the rest a button. */
function clickRole(node: SnapshotNode): { role: string; why: string } | null {
  const reaction = (node.reactions ?? []).find(({ trigger }) => trigger !== null && PRESSES.has(trigger.type));
  const action = reaction?.actions?.[0];

  if (action === undefined) {
    return null;
  }

  if (action.type === "URL") {
    return {
      role: "link",
      why: `a click opens ${action.url ?? "a URL"}`,
    };
  }

  if (action.type === "NODE" && action.navigation === "NAVIGATE") {
    return {
      role: "link",
      why: `a click goes to ${action.destinationName ?? "another screen"}`,
    };
  }

  return {
    role: "button",
    why: `a click does ${action.type === "NODE" ? (action.navigation ?? "it").toLowerCase() : action.type.toLowerCase()}`,
  };
}

/** A layer's role in the markup, and why: its component's kind, its prototype's action, or its component's name. */
export function roleOf(node: SnapshotNode): { role: string; why: string } | null {
  const component = node.type === "INSTANCE" ? (node.instance?.setName ?? node.instance?.componentName ?? "") : "";
  const named = COMPONENT_ROLES.find(([test]) => test.test(component));
  const byComponent =
    named === undefined
      ? null
      : {
          role: named[1],
          why: `a ${component} component`,
        };

  if (byComponent !== null && KINDS.has(byComponent.role)) {
    return byComponent;
  }

  return clickRole(node) ?? byComponent;
}

/** A layer's visible texts, in order, as one line. */
function textsOf(node: SnapshotNode): string {
  const own = node.type === "TEXT" && node.visible ? [node.text?.characters ?? ""] : [];

  return [...own, ...(node.visible ? (node.children ?? []).map(textsOf) : [])]
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .join(" ");
}

/** A field's label: the text right before it in its parent, or a text in it named for a label. */
function fieldLabel(node: SnapshotNode, parent: SnapshotNode | null): string | null {
  const siblings = (parent?.children ?? []).filter((child) => child.visible);
  const before = siblings[siblings.indexOf(node) - 1];
  const inside = (node.children ?? []).find((child) => child.type === "TEXT" && /label/i.test(child.name));
  const label = before?.type === "TEXT" ? before.text?.characters : inside?.text?.characters;

  return label === undefined || label.trim() === "" ? null : label.trim().slice(0, 80);
}

/** A name to label a control by: its own unless Figma gave it, else its component's. */
function nameFor(node: SnapshotNode): string {
  return DEFAULT_NAME.test(node.name)
    ? (node.instance?.setName ?? node.instance?.componentName ?? node.name)
    : node.name;
}

/** A layer people press or type in, with its role and label; null for any other. */
export function controlOf(node: SnapshotNode, parent: SnapshotNode | null): A11yControl | null {
  const role = roleOf(node);

  if (role === null) {
    return null;
  }

  const text =
    role.role === "textbox" || role.role === "combobox" ? fieldLabel(node, parent) : textsOf(node).slice(0, 80);
  const label = text === null || text === "" ? null : text;

  return {
    id: node.id,
    name: node.name,
    ...role,
    label,
    ...(label === null ? { suggestion: `aria-label "${nameFor(node)}"` } : {}),
  };
}
