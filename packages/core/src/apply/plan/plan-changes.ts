import { isLayoutDisplay } from "../../css-mapping/groups/layout/layout.ts";
import { isInInstance } from "../../kernel/layer-ids.ts";
import { changeOf } from "../change-of.ts";
import type { ApplyChange, ApplyElement, ApplyError } from "../types.ts";
import type { Assessment } from "./assessment.ts";
import type { CurrentLayers } from "./current-layers.ts";
import { movedRefs } from "./moves.ts";
import { writesSomething } from "./send-list.ts";

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
    // A new TextPath whose d or arc was refused is not made: Figma makes one only along its path, and the error says.
    changes: withoutSwitchedLayers(changes, errors).filter((change) => !isPathless(change)),
    errors,
  };
}

function isPathless(change: ApplyChange): boolean {
  return (
    change.kind === "create" &&
    change.tag === "TextPath" &&
    change.copyOf === undefined &&
    change.props.path === undefined
  );
}

/**
 * The changes less those that write a layer inside an instance the call switches to another variant or component,
 * each refused with an error: Figma gives that instance's layers new ids (live, 2026-10-22), so the real run would no
 * longer find the layer once the switch is written, while a dry run, which switches nothing, would.
 */
function withoutSwitchedLayers(changes: readonly ApplyChange[], errors: ApplyError[]): ApplyChange[] {
  const switched = changes.filter(switches);

  return changes.filter((change) => {
    const instance = writesSomething(change) ? switched.find((other) => isLayerOf(change, other)) : undefined;

    if (instance !== undefined) {
      errors.push(switchedError(change, instance));
    }

    return instance === undefined;
  });
}

/** An instance there (in the file, a copy or a new instance) given a component or a variant, or a copy given one. */
function switches(change: ApplyChange): boolean {
  const { component, variant } = change.props;

  return (
    change.tag === "Instance" &&
    (change.kind === "update" || change.copyOf !== undefined) &&
    (component !== undefined || variant !== undefined)
  );
}

/** Whether a change names a layer inside the instance: by the instance's ids, where the instance's layers are named. */
function isLayerOf(change: ApplyChange, instance: ApplyChange): boolean {
  // A copy's own layers are named inside it by the copied layer's ids; any other's where the instance itself is.
  const scope = instance.copyOf === undefined ? instance.copy : instance.ref;
  const id = instance.copyOf ?? instance.source ?? instance.id;
  const named = change.source ?? change.id;

  return change.copy === scope && id !== null && named !== null && isInInstance(named, id);
}

function switchedError(change: ApplyChange, instance: ApplyChange): ApplyError {
  const to = instance.props.component === undefined ? "variant" : "component";
  const where =
    instance.id ??
    (instance.copyOf === undefined ? `the instance standing for ${instance.source}` : `the copy of ${instance.copyOf}`);

  return {
    line: change.line,
    column: change.column,
    ...(change.id === null ? {} : { id: change.id }),
    message: `This layer is inside ${where}, which this call switches to another ${to}: Figma gives the instance's layers new ids then, so this layer is not written.`,
    hint: `Switch the ${to} first, read the instance again, then edit its layers by their new ids.`,
  };
}

/**
 * Whether nothing lays the element's layer out where it goes, so its edges place it: a parent element without auto
 * layout (a section, a frame displayed as a block), or the page a top-level layer is on. A new top-level layer is
 * placed by its edges too: where the call's parent lays it out, the plugin refuses them.
 */
function isPlaced({ element, entry }: Assessment, byRef: ReadonlyMap<string, Assessment>): boolean {
  const parent = element.parent === null ? undefined : byRef.get(element.parent);

  if (parent === undefined) {
    return element.parent === null && (element.id === null || entry?.parent === null);
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
