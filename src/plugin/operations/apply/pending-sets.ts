import { InjectionToken, inject, injectable } from "@needle-di/core";
import { COMPONENT_INDEX } from "@/plugin/adapters/figma/components/component-index.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT, NEW_LAYER_TYPE, NEW_LAYER_VALUE } from "@/plugin/operations/apply/apply.constants.ts";
import type { PendingSet, Run } from "@/plugin/operations/apply/apply.types.ts";
import { APPLY_LAYERS } from "@/plugin/operations/apply/apply-layers.ts";
import type { Refusal } from "@/plugin/operations/apply/checks.ts";
import { PROPERTY_MARKS } from "@/plugin/operations/apply/property-marks.ts";
import { LAYER_WRITER } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS } from "@/plugin/operations/apply/writers/writers.constants.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData, ApplyProperty } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type Fail = (error: unknown, keys?: readonly (keyof FigmaProps)[]) => void;

/**
 * A real call's writes and what they wait for (P-149, m:bc6811ca): each change is written onto its layer; a new set's
 * variants are written in the frame holding them, without what places them in the set (a grid cell, their alignment),
 * which the frame has no layout for. Once a set's XML has ended its variants are combined where the frame was, the set
 * written, laid out as a grid when nothing else lays it out, and what waited placed; then the properties components'
 * layers make are bound, those inside a set still open later.
 */
@injectable()
export class PendingSets {
  /** What places a layer in its parent's layout: a held set's variant takes it once the set is made. */
  readonly #placing: ReadonlySet<string> = new Set([...STEP_KEYS.child, ...STEP_KEYS.gridCell]);
  readonly #writer;
  readonly #layers;
  readonly #components;
  readonly #marks;

  constructor(
    writer = inject(LAYER_WRITER),
    layers = inject(APPLY_LAYERS),
    components = inject(COMPONENT_INDEX),
    marks = inject(PROPERTY_MARKS),
  ) {
    this.#writer = writer;
    this.#layers = layers;
    this.#components = components;
    this.#marks = marks;
  }

  /** A call's start: the names of the components and sets its XML makes, no mark of another call. */
  start(changes: readonly ApplyChangeData[], dry: boolean): void {
    const sets = new Set(
      changes.filter((change) => this.#makes(change, FIGMA_NODE_TYPE.componentSet)).map(({ ref }) => ref),
    );
    const owners = changes.filter(
      (change) =>
        this.#makes(change, FIGMA_NODE_TYPE.componentSet) ||
        (this.#makes(change, FIGMA_NODE_TYPE.component) && !sets.has(change.parent ?? "")),
    );

    this.#components.start(owners.flatMap(({ props }) => (props.name === undefined ? [] : [props.name])));
    this.#marks.start(dry);
  }

  /** The properties the call's marks added to components there before it (a dry run's: would add). */
  properties(): ApplyProperty[] {
    return this.#marks.added();
  }

  hold(
    run: Run,
    change: ApplyChangeData,
    holder: SceneNode,
    refusals: Refusal[],
  ): void {
    run.sets.push({ change, holder, refusals, placing: [] });
  }

  /** A change written; a held set's variant's placing waits for the set. */
  async write(
    run: Run,
    change: ApplyChangeData,
    node: SceneNode,
    refusals: readonly Refusal[],
  ): Promise<void> {
    const set = run.sets.find((pending) => pending.change.ref === change.parent);
    const placing = this.#part(change.props, true);
    const waits = set !== undefined && Object.keys(placing).length > 0;

    if (waits) {
      set.placing.push({ node, change: { ...change, props: placing }, refusals });
    }

    await this.#write(run, waits ? { ...change, props: this.#part(change.props, false) } : change, node, refusals);
  }

  /** The sets whose XML has ended (none holds `next`) made, then the marks outside the sets still open bound; a layer
   * the call made whose mark cannot bind goes. */
  async settle(run: Run, next?: ApplyChangeData): Promise<void> {
    const open = this.#holding(next, run.changes);
    const ready = run.sets.filter(({ change }) => !open.has(change.ref));

    run.sets.splice(0, run.sets.length, ...run.sets.filter(({ change }) => open.has(change.ref)));

    for (const pending of ready) {
      await this.#finish(run, pending);
    }

    const { bound, failed } = await this.#marks.bind(new Set(run.sets.map(({ holder }) => holder.id)));

    for (const node of bound) {
      run.report.wroteTo(node.id);
    }

    for (const { node, error } of failed) {
      const change = run.changes.find(({ ref }) => run.layers.get(ref) === node);

      if (change !== undefined) {
        run.report.fail(change, error, STEP_KEYS.property);
        this.#discard(run, change, node);
      }
    }
  }

  /**
   * A layer this call made, its mark unbound, goes with what it holds, so nothing half-made stays in the file; a layer
   * that was there before the call goes back where it stood first, and when one cannot nothing goes.
   */
  #discard(
    run: Run,
    change: ApplyChangeData,
    node: SceneNode,
  ): void {
    if (run.report.isMade(node.id)) {
      this.#remove(run, change, node);
    }
  }

  /** The way every layer of the call goes: what was there before the call goes back first, and when one cannot it stays. */
  #remove(
    run: Run,
    change: ApplyChangeData,
    node: SceneNode,
  ): void {
    try {
      run.origins.restore(node);
    } catch (error) {
      run.report.fail(change, new WriteError(APPLY_TEXT.keptHeld(error), APPLY_TEXT.keptHeldHint));

      return;
    }

    run.report.unmade(node.id);

    for (const inner of "findAll" in node ? node.findAll() : []) {
      run.report.unmade(inner.id);
    }

    this.#layers.discard(node);
  }

  async #write(
    run: Run,
    change: ApplyChangeData,
    node: SceneNode,
    refusals: readonly Refusal[],
  ): Promise<void> {
    const wrote = await this.#writer.write(node, change, refusals, this.#fail(run, change));

    if (change.kind !== APPLY_CHANGE_KIND.create) {
      if (wrote || (change.moves ?? false)) {
        run.report.wroteTo(node.id);
      }

      return;
    }

    try {
      this.#layers.finish(node, change);
    } catch (error) {
      this.#remove(run, change, node);

      throw error;
    }

    run.report.made(change, node);

    // A component or set made here is found by the instances after it; a held set's variant through its set.
    if (
      node.type === FIGMA_NODE_TYPE.componentSet ||
      (node.type === FIGMA_NODE_TYPE.component && !run.sets.some((pending) => pending.change.ref === change.parent))
    ) {
      this.#components.add(node);
    }
  }

  async #finish(run: Run, { change, holder, refusals, placing }: PendingSet): Promise<void> {
    const set = this.#combined(run, change, holder);

    if (set === null) {
      return;
    }

    run.layers.set(change.ref, set);

    try {
      await this.#write(run, change, set, refusals);

      // A set with auto layout or a grid lays its variants out itself, placed by what waited for it.
      if (set.layoutMode === NEW_LAYER_VALUE.none) {
        this.#layers.layOut(set);
      }

      for (const one of placing) {
        await this.#writer.write(one.node, one.change, one.refusals, this.#fail(run, one.change));
      }
    } catch (error) {
      run.report.fail(change, error);
    }
  }

  /** The set made of the Components its frame holds; null, its error told, when Figma refuses (the frame goes). */
  #combined(
    run: Run,
    change: ApplyChangeData,
    holder: SceneNode,
  ): ComponentSetNode | null {
    try {
      return this.#layers.combine(holder, run.origins);
    } catch (error) {
      run.report.fail(change, error);
      this.#clearHolder(run, change, holder);

      return null;
    }
  }

  /** A set that could not be made: what the call moved into its frame goes back, then the frame goes; when it cannot, it stays. */
  #clearHolder(
    run: Run,
    change: ApplyChangeData,
    holder: SceneNode,
  ): void {
    try {
      run.origins.restore(holder);
    } catch (error) {
      run.report.fail(change, new WriteError(APPLY_TEXT.keptHeld(error), APPLY_TEXT.keptHeldHint));

      return;
    }

    this.#layers.discard(holder);
  }

  #fail(run: Run, change: ApplyChangeData): Fail {
    return (error, keys) => run.report.fail(change, error, keys);
  }

  /** The refs of the elements holding a change: a set among them is still open. */
  #holding(next: ApplyChangeData | undefined, changes: readonly ApplyChangeData[]): Set<string> {
    const byRef = new Map(changes.map((change) => [change.ref, change]));
    const refs = new Set<string>();

    for (let ref = next?.parent ?? null; ref !== null; ref = byRef.get(ref)?.parent ?? null) {
      refs.add(ref);
    }

    return refs;
  }

  /** A change's props, those that place it in its parent's layout or the rest. */
  #part(props: FigmaProps, placing: boolean): FigmaProps {
    return Object.fromEntries(
      Object.entries(props).filter(([key]) => this.#placing.has(key) === placing),
    ) as FigmaProps;
  }

  /** Whether a change makes a layer of this type from nothing (not a copy). */
  #makes(change: ApplyChangeData, type: NodeType): boolean {
    return (
      change.kind === APPLY_CHANGE_KIND.create && change.copyOf === undefined && NEW_LAYER_TYPE[change.tag] === type
    );
  }
}

export const PENDING_SETS = new InjectionToken<PendingSets>("PendingSets");
