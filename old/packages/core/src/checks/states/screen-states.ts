/** The states a screen is drawn in besides its usual one, by the words designers name its frames with. */
const STATE_WORDS: readonly (readonly [string, RegExp])[] = [
  ["empty", /\b(empty|no (results|data|items)|zero state)\b/i],
  ["loading", /\b(loading|skeleton|spinner)\b/i],
  ["error", /\b(error|errors|failed|failure|offline)\b/i],
  ["success", /\b(success|done|confirmation|confirmed|thank you|completed?)\b/i],
];

/** Words in a frame's name that say its width, not what it is. */
const WIDTHS = /\b(desktop|mobile|tablet|phone|web|ios|android|\d{3,4}(px)?)\b/gi;

/** Screens that show data and so need an empty, a loading and an error state; forms, an error and a success. */
const KINDS: readonly { readonly kind: string; readonly test: RegExp; readonly needs: readonly string[] }[] = [
  {
    kind: "list",
    test: /\b(list|table|feed|inbox|results|search|cart|orders|notifications|messages|dashboard|history|files|projects|library|catalog(ue)?)\b/i,
    needs: ["empty", "loading", "error"],
  },
  {
    kind: "form",
    test: /\b(form|checkout|sign ?up|sign ?in|log ?in|register|registration|payment|contact|onboarding)\b/i,
    needs: ["error", "success"],
  },
];

/** A screen's frames as one: its name without state and width words, its kind, its states and the ones it lacks. */
export interface ScreenStates {
  readonly name: string;
  readonly kind: string;
  readonly frames: string[];
  readonly states: string[];
  readonly missing: string[];
}

/** A frame's name without the words of its state and width, and its separators. */
function baseOf(name: string): string {
  const stripped = STATE_WORDS.reduce((rest, [, words]) => rest.replace(words, " "), name.replace(WIDTHS, " "));

  return stripped
    .replace(/\b(state|states|variant)\b/gi, " ")
    .replace(/[–—\-/|()[\]:,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The page's screens grouped by name (Inbox, Inbox – Empty, Inbox – Mobile are one), each list or form with the states
 * its frames show and the ones none does; screens of other kinds are left out.
 */
export function screenStates(frames: readonly { id: string; name: string }[]): ScreenStates[] {
  const groups = new Map<string, { name: string; frames: string[]; states: Set<string> }>();

  for (const frame of frames) {
    const base = baseOf(frame.name);
    const key = base.toLowerCase();
    const group = groups.get(key) ?? {
      name: base,
      frames: [],
      states: new Set<string>(),
    };

    group.frames.push(frame.id);

    for (const [state, words] of STATE_WORDS) {
      if (words.test(frame.name)) {
        group.states.add(state);
      }
    }

    groups.set(key, group);
  }

  return [...groups.values()].flatMap(({ name, frames: ids, states }) => {
    const kind = KINDS.find(({ test }) => test.test(name));

    return kind === undefined || name === ""
      ? []
      : [
          {
            name,
            kind: kind.kind,
            frames: ids,
            states: [...states],
            missing: kind.needs.filter((state) => !states.has(state)),
          },
        ];
  });
}
