import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ATTRIBUTE, CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import type { ApplyChange, ApplyElement, ApplyError } from "@/core/apply/apply.types.ts";
import { ASSESSOR } from "@/core/apply/plan/assessor.ts";
import { CHANGE_OF } from "@/core/apply/plan/change-of.ts";
import type { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import { LAYER_READS } from "@/core/apply/plan/layer-reads.ts";
import { PLACED_LAYERS } from "@/core/apply/plan/placed-layers.ts";
import { PLAN_TEXT, PLAN_VALUE } from "@/core/apply/plan/plan.constants.ts";
import type { Assessment, FileChange, LayerEntry, WritePlan } from "@/core/apply/plan/plan.types.ts";
import { PlannedComponents } from "@/core/apply/plan/planned-components.ts";
import { TAG } from "@/core/xml/tags.constants.ts";

/** The changes left once the planner refused what a dry run cannot make, and what the creates make. */
type Planned = Pick<WritePlan, "components"> & { readonly planned: ApplyChange[] };

/**
 * The one planner (T-142): which layers a call reads, then each element against its layer (assessment), as a change in
 * Figma's terms, placed by its edges where nothing lays it out, with the list the plugin gets and the components a dry
 * run remembers. The same plan feeds the dry and the real run, so what only a real run would find wrong is refused
 * here: an edit inside an instance the call switches (T-128), an instance of a set made here without its variant. The files elements name are compared by the server
 * (T-132): what it found they change is written, and a file it cannot use is an error on its attribute.
 */
@injectable()
export class WritePlanner {
  readonly #reads;
  readonly #assessor;
  readonly #changeOf;
  readonly #placed;

  constructor(
    reads = inject(LAYER_READS),
    assessor = inject(ASSESSOR),
    changeOf = inject(CHANGE_OF),
    placed = inject(PLACED_LAYERS),
  ) {
    this.#reads = reads;
    this.#assessor = assessor;
    this.#changeOf = changeOf;
    this.#placed = placed;
  }

  /** The ids the call reads before it plans (C-169). */
  layersToRead(elements: readonly ApplyElement[]): string[] {
    return this.#reads.ids(elements);
  }

  plan(
    elements: readonly ApplyElement[],
    layers: CurrentLayers,
    files: ReadonlyMap<string, FileChange> = new Map(),
  ): WritePlan {
    const assessment = this.#assessor.assess(elements, layers);
    const errors = assessment.errors;
    const assessed = assessment.assessed.map((item) => this.#filed(item, files.get(item.element.ref), errors));
    const byRef = new Map(assessed.map((item) => [item.element.ref, item]));
    const changes: ApplyChange[] = [];
    const notWritten = new Map<string, string[]>();
    const moved = this.#moved(elements, assessed);

    for (const item of assessed) {
      const made = this.#changeOf.of(item.element, item.now, this.#placed.isPlaced(item, byRef));

      if (moved.has(item.element.ref)) {
        made.change = { ...made.change, moves: true };
      }

      const unwritten = this.#changeOf.unwritten(item.element);

      if (unwritten.length > 0) {
        notWritten.set(item.element.ref, unwritten);
      }

      // A new TextPath whose path was refused is not made: Figma makes one only along its path, and the error says (C-179).
      if (!this.#pathless(made.change)) {
        changes.push(made.change);
      }

      errors.push(...made.errors);
    }

    const { planned, components } = this.#planned(this.#withoutSwitched(changes, errors), errors);

    return {
      assessed,
      changes: planned,
      written: planned.filter((change) => this.#writes(change)),
      send: this.#sendList(planned),
      errors: this.#inOrder(errors),
      notWritten,
      components,
    };
  }

  /** What the layer holds once its files are compared: a file of another image is written, one that cannot be used not. */
  #filed(
    item: Assessment,
    file: FileChange | undefined,
    errors: ApplyError[],
  ): Assessment {
    if (file === undefined || item.now === undefined) {
      return item;
    }

    const { element, now } = item;
    const attributes = new Set([...now.attributes].filter((name) => !file.changed.includes(name)));

    for (const { attribute, message } of file.problems) {
      attributes.add(attribute);
      errors.push({
        line: element.line,
        column: element.column,
        ...(element.id === null ? {} : { id: element.id }),
        attribute,
        message,
      });
    }

    return { ...item, now: { ...now, attributes } };
  }

  /** Whether a change writes its layer: makes it, gives it a property, or writes its text. */
  #writes(change: ApplyChange): boolean {
    return (
      change.kind === CHANGE_KIND.create ||
      (change.moves ?? false) ||
      Object.keys(change.props).length > 0 ||
      change.text !== undefined
    );
  }

  /**
   * The elements that move their layer, by ref (T-124): placed with before or after, under a parent element that is not
   * the layer's parent (a new one included), or listed after a layer it stands before in Figma. Every element counts as
   * a parent, a refused one too; a top-level one moves only by before or after.
   */
  #moved(elements: readonly ApplyElement[], assessed: readonly { element: ApplyElement; entry?: LayerEntry }[]) {
    const byRef = this.#reads.byRef(elements);
    // The furthest place in its parent of a layer listed so far, by parent.
    const furthest = new Map<string, number>();
    const moved = new Set<string>();

    for (const { element, entry } of assessed) {
      const inside = element.parent === null ? undefined : byRef.get(element.parent);

      if (element.source !== undefined) {
        // A layer inside a copy is named by its source's id: it moves only by before or after (B-019).
        if (
          entry !== undefined &&
          (element.attributes.before !== undefined || element.attributes.after !== undefined)
        ) {
          moved.add(element.ref);
        }
      } else if (element.id !== null && entry !== undefined && this.#moves(element, entry, inside, furthest)) {
        moved.add(element.ref);
      }
    }

    return moved;
  }

  #moves(
    element: ApplyElement,
    entry: LayerEntry,
    inside: ApplyElement | undefined,
    furthest: Map<string, number>,
  ): boolean {
    if (element.attributes.before !== undefined || element.attributes.after !== undefined) {
      return true;
    }

    const parent = entry.parent?.id ?? entry.page ?? null;

    if (inside === undefined || parent === null || inside.id !== parent) {
      return inside !== undefined;
    }

    const at = (entry.parent?.children ?? []).findIndex((child) => child.id === entry.layer.id);
    const before = furthest.get(parent) ?? -1;

    furthest.set(parent, Math.max(before, at));

    return at !== -1 && at < before;
  }

  #pathless(change: ApplyChange): boolean {
    return (
      change.kind === CHANGE_KIND.create &&
      change.tag === TAG.TEXT_PATH &&
      change.copyOf === undefined &&
      change.props.path === undefined
    );
  }

  /**
   * The changes the plugin gets (C-176): what writes something, and a layer made or moved with its parent and the
   * layers beside it, unchanged, so the plugin finds where it goes. The rest stays here, in document order.
   */
  #sendList(changes: readonly ApplyChange[]): ApplyChange[] {
    const made = changes.filter((change) => change.kind === CHANGE_KIND.create || (change.moves ?? false));
    const parents = new Set(made.flatMap((change) => (change.parent === null ? [] : [change.parent])));
    const beside = new Set(made.map((change) => change.parent ?? ""));

    return changes.filter(
      (change) => this.#writes(change) || parents.has(change.ref) || beside.has(change.parent ?? ""),
    );
  }

  /**
   * The changes less those that write a layer inside an instance the call switches to another variant or component,
   * each refused: Figma gives that instance's layers new ids (B-029), so the real run would no longer find the layer once
   * the switch is written, while a dry run, which switches nothing, would.
   */
  #withoutSwitched(changes: readonly ApplyChange[], errors: ApplyError[]): ApplyChange[] {
    const switched = changes.filter((change) => this.#switches(change));

    return changes.filter((change) => {
      const instance = this.#writes(change) ? switched.find((other) => this.#isLayerOf(change, other)) : undefined;

      if (instance !== undefined) {
        errors.push(this.#switchedError(change, instance));
      }

      return instance === undefined;
    });
  }

  /** An instance there (in the file, a copy or a new instance) given a component or a variant, or a copy given one. */
  #switches({ tag, kind, copyOf, props }: ApplyChange): boolean {
    return (
      tag === TAG.INSTANCE &&
      (kind === CHANGE_KIND.update || copyOf !== undefined) &&
      (props.component !== undefined || props.variant !== undefined)
    );
  }

  /** Whether a change names a layer inside the instance: by the ids its layers have there, I<instance>;… */
  #isLayerOf(change: ApplyChange, instance: ApplyChange): boolean {
    // A copy's own layers are named inside it by the copied layer's ids; any other's where the instance itself is.
    const scope = instance.copyOf === undefined ? instance.copy : instance.ref;
    const id = instance.copyOf ?? instance.source ?? instance.id;
    const named = change.source ?? change.id;

    return change.copy === scope && id !== null && (named?.startsWith(PLAN_VALUE.insideInstance(id)) ?? false);
  }

  #switchedError(change: ApplyChange, instance: ApplyChange): ApplyError {
    const to = instance.props.component === undefined ? PLAN_VALUE.variant : PLAN_VALUE.component;
    const where =
      instance.id ??
      (instance.copyOf === undefined
        ? PLAN_TEXT.standingFor(instance.source ?? "")
        : PLAN_TEXT.copyOf(instance.copyOf));

    return {
      line: change.line,
      column: change.column,
      ...(change.id === null ? {} : { id: change.id }),
      message: PLAN_TEXT.switched(where, to),
      hint: PLAN_TEXT.switchedHint(to),
    };
  }

  /**
   * What the creates make for the instances after them (C-178), and the changes less a new instance of a set made here
   * with values none of its variants has: refused on dry and real runs alike, as a dry run makes no set to look in.
   */
  #planned(changes: readonly ApplyChange[], errors: ApplyError[]): Planned {
    const components = new PlannedComponents();
    const byRef = new Map(changes.map((change) => [change.ref, change]));

    for (const change of changes) {
      components.record(change, byRef);
    }

    const planned = changes.filter((change) => {
      const { component, variant } = change.props;
      const missing =
        change.kind === CHANGE_KIND.create && change.tag === TAG.INSTANCE && component !== undefined
          ? components.missingVariant(component, variant ?? {})
          : null;

      if (missing !== null) {
        errors.push({
          line: change.line,
          column: change.column,
          attribute: change.sources.variant ?? ATTRIBUTE.variant,
          message: missing,
        });
      }

      return missing === null;
    });

    return { planned, components };
  }

  /** Errors in document order, the assessment's and the changes' together. */
  #inOrder(errors: readonly ApplyError[]): ApplyError[] {
    return [...errors].sort((first, second) => first.line - second.line || first.column - second.column);
  }
}

export const WRITE_PLANNER = new InjectionToken<WritePlanner>("WritePlanner");
