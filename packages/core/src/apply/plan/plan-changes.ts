import { changeOf } from "../change-of.ts";
import type { ApplyChange, ApplyElement, ApplyError } from "../types.ts";
import type { Assessment } from "./assessment.ts";
import type { CurrentLayers } from "./current-layers.ts";
import { movedRefs } from "./moves.ts";

/** What the files an element names change: attributes written again (their file holds another image), problems. */
export interface FileChanges {
  readonly changed: readonly string[];
  readonly problems: readonly { readonly attribute: string; readonly message: string }[];
}

const NO_FILE_CHANGES: FileChanges = {
  changed: [],
  problems: [],
};

/** A call's assessed elements and what it read, with what their files change, by element ref. */
export interface PlanInput {
  readonly elements: readonly ApplyElement[];
  readonly assessed: readonly Assessment[];
  readonly layers: CurrentLayers;
  readonly files: ReadonlyMap<string, FileChanges>;
}

/**
 * Each assessed element as a change in Figma's terms, an attribute whose file holds another image written again, and
 * a moved layer marked; errors element by element: the change's, then its files'.
 */
export function planChanges({ elements, assessed, layers, files }: PlanInput): {
  changes: ApplyChange[];
  errors: ApplyError[];
} {
  const moved = movedRefs(elements, layers);
  const changes: ApplyChange[] = [];
  const errors: ApplyError[] = [];

  for (const { element, now } of assessed) {
    const differ = files.get(element.ref) ?? NO_FILE_CHANGES;
    const { change, errors: translated } = changeOf(
      element,
      now === undefined
        ? undefined
        : {
            ...now,
            attributes: new Set([...now.attributes].filter((name) => !differ.changed.includes(name))),
          },
    );

    changes.push(
      moved.has(change.ref)
        ? {
            ...change,
            move: true,
          }
        : change,
    );
    errors.push(...translated, ...differ.problems.map((problem) => fileError(element, problem)));
  }

  return {
    changes,
    errors,
  };
}

function fileError(element: ApplyElement, { attribute, message }: FileChanges["problems"][number]): ApplyError {
  return {
    line: element.line,
    column: element.column,
    ...(element.id === null ? {} : { id: element.id }),
    attribute,
    message,
  };
}
