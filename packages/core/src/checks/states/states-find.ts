import { type ComponentEntry, componentStates } from "./component-states.ts";
import { type ScreenStates, screenStates } from "./screen-states.ts";

/** What states_find answers: the interactive components and the data and form screens, each with its states. */
export interface StatesFound {
  readonly summary: string;
  readonly components: {
    readonly id: string;
    readonly name: string;
    readonly kind: string;
    readonly states: string[];
    readonly missing: string[];
    readonly properties: string[];
  }[];
  readonly screens: ScreenStates[];
}

/**
 * The states a design is drawn in and the ones it lacks: each interactive component's (hover, focus, pressed,
 * disabled; error for a field, selected for a toggle or a tab), and each list's or form's screens (empty, loading,
 * error; error and success). Those lacking most come first.
 */
export function statesFind({
  components,
  screens,
}: {
  components: readonly ComponentEntry[];
  screens: readonly { id: string; name: string }[];
}): StatesFound {
  const interactive = components
    .flatMap((entry) => {
      const states = componentStates(entry);

      return states === null
        ? []
        : [
            {
              id: entry.id,
              name: entry.name,
              kind: states.kind,
              states: states.present,
              missing: states.missing,
              properties: states.properties,
            },
          ];
    })
    .sort((a, b) => b.missing.length - a.missing.length);
  const grouped = screenStates(screens);
  const lacking = (list: readonly { missing: readonly string[] }[]) =>
    list.filter(({ missing }) => missing.length > 0).length;

  return {
    summary: `${interactive.length} interactive components, ${lacking(interactive)} of them missing states; ${grouped.length} screens with data or forms, ${lacking(grouped)} of them missing states.`,
    components: interactive,
    screens: grouped,
  };
}
