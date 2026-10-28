import type * as z from "zod";
import type { ComponentEntrySchema } from "../../schemas/operation-shapes.ts";

/** A component or set as components_read lists it. */
export type ComponentEntry = z.output<typeof ComponentEntrySchema>;

/** The states an interactive component is drawn in. */
export type InteractionState =
  | "default"
  | "hover"
  | "focus"
  | "pressed"
  | "disabled"
  | "error"
  | "selected"
  | "loading";

/** The words designers name each state by, as a variant's value or a property's name. */
const STATE_WORDS: Readonly<Record<InteractionState, RegExp>> = {
  default: /^(default|rest|resting|normal|idle|enabled|base)$/i,
  hover: /^(hover|hovered|hovering|mouse ?over)$/i,
  focus: /^(focus|focused|focus[- ]?visible|keyboard ?focus)$/i,
  pressed: /^(pressed|active|down|clicked|tapped)$/i,
  disabled: /^(disabled|inactive|unavailable)$/i,
  error: /^(error|invalid|danger|failed)$/i,
  selected: /^(selected|checked|on|current|chosen)$/i,
  loading: /^(loading|busy|pending|in ?progress)$/i,
};

/** Interactive components by their names, and the states each kind needs drawn. */
const KINDS: readonly { readonly kind: string; readonly test: RegExp; readonly needs: readonly InteractionState[] }[] =
  [
    {
      kind: "field",
      test: /\b(input|text ?field|textarea|text ?area|search ?(field|bar)|select|dropdown|combo ?box|date ?picker)\b/i,
      needs: ["hover", "focus", "disabled", "error"],
    },
    {
      kind: "toggle",
      test: /\b(checkbox|check ?box|radio|switch|toggle)\b/i,
      needs: ["hover", "focus", "disabled", "selected"],
    },
    {
      kind: "tab",
      test: /\b(tab|segment|segmented ?control|chip|pill)\b/i,
      needs: ["hover", "focus", "selected"],
    },
    {
      kind: "link",
      test: /\blink\b/i,
      needs: ["hover", "focus"],
    },
    {
      kind: "button",
      test: /\b(button|btn|cta|icon ?button|menu ?item)\b/i,
      needs: ["hover", "focus", "pressed", "disabled"],
    },
  ];

/** An interactive component's states: its kind, the states it has and lacks, and the properties holding them. */
export interface ComponentStates {
  readonly kind: string;
  readonly present: InteractionState[];
  readonly missing: InteractionState[];
  readonly properties: string[];
}

/** A property's name without Figma's #id suffix (a boolean's "Disabled#12:3"). */
const bare = (name: string) => name.replace(/#[^#]*$/, "").trim();

/** The state a word names, if it names one. */
function stateOf(word: string): InteractionState | undefined {
  return (Object.keys(STATE_WORDS) as InteractionState[]).find((state) => STATE_WORDS[state].test(word.trim()));
}

/**
 * The states a component (or set) is drawn in, when its name says it is interactive: a variant's values (State=Hover),
 * and boolean or variant properties named for a state (Disabled, Loading). Null for a component that is not.
 */
export function componentStates(entry: Pick<ComponentEntry, "name" | "properties">): ComponentStates | null {
  const kind = KINDS.find(({ test }) => test.test(entry.name));

  if (kind === undefined) {
    return null;
  }

  const present = new Set<InteractionState>();
  const properties = new Set<string>();

  for (const [name, property] of Object.entries(entry.properties)) {
    const own = stateOf(bare(name));
    const values =
      property.type === "VARIANT" ? (property.options ?? []).flatMap((option) => stateOf(option) ?? []) : [];

    if (own !== undefined && (property.type === "BOOLEAN" || property.type === "VARIANT")) {
      present.add(own);
      properties.add(bare(name));
    }

    for (const state of values) {
      present.add(state);
      properties.add(bare(name));
    }
  }

  return {
    kind: kind.kind,
    present: [...present],
    missing: kind.needs.filter((state) => !present.has(state)),
    properties: [...properties],
  };
}
