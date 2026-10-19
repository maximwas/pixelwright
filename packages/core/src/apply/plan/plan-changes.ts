import { isLayoutDisplay } from "../../css-mapping/groups/layout/layout.ts";
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
  const byRef = new Map(assessed.map((item) => [item.element.ref, item]));
  const changes: ApplyChange[] = [];
  const errors: ApplyError[] = [];

  for (const item of assessed) {
    const { element, now } = item;
    const differ = files.get(element.ref) ?? NO_FILE_CHANGES;
    const { change, errors: translated } = changeOf(
      element,
      now === undefined
        ? undefined
        : {
            ...now,
            attributes: new Set([...now.attributes].filter((name) => !differ.changed.includes(name))),
          },
      isPlaced(item, byRef),
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

/**
 * Whether nothing lays the element's layer out where it goes, so its edges place it: a parent element without auto
 * layout (a section, a frame displayed as a block), or the page a top-level layer is on. A new top-level layer goes
 * where the plugin finds out.
 */
function isPlaced({ element, entry }: Assessment, byRef: ReadonlyMap<string, Assessment>): boolean {
  const parent = element.parent === null ? undefined : byRef.get(element.parent);

  if (parent === undefined) {
    return element.parent === null && entry !== undefined && entry.parent === null;
  }

  const { display } = parent.element.attributes;

  // A parent hidden by display="none" keeps the layout it has.
  return !isLayoutDisplay((display === "none" ? undefined : display) ?? parent.now?.current.display ?? "block");
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
