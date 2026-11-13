import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { NEW_LAYER_TYPE } from "@/plugin/operations/apply/apply.constants.ts";
import type { Run } from "@/plugin/operations/apply/apply.types.ts";
import { APPLY_LAYERS } from "@/plugin/operations/apply/apply-layers.ts";
import type { Refusal } from "@/plugin/operations/apply/checks.ts";
import { Counterparts } from "@/plugin/operations/apply/counterparts.ts";
import { Origins } from "@/plugin/operations/apply/origins.ts";
import { PENDING_SETS } from "@/plugin/operations/apply/pending-sets.ts";
import { ApplyReport } from "@/plugin/operations/apply/report.ts";
import { LAYER_WRITER } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { applyOp } from "@/shared/ops/apply/apply.manifest.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

export type ApplyInput = zod.output<typeof applyOp.input>;

export type ApplyOutput = zod.output<typeof applyOp.output>;

/**
 * design_apply's changes in Figma (T-121, A§6.2 step 7), element by element in document order, so one that fails
 * leaves the others: each layer found or made, checked, then written on a real run; a dry run runs the same checks and
 * writes nothing. New component sets and the properties components' layers make wait (PendingSets), and a new instance
 * is made once what the call made before it is whole (P-083). One undo step closes a real call.
 */
@injectable()
export class ApplyRun {
  readonly #layers;
  readonly #writer;
  readonly #sets;
  readonly #history;

  constructor(
    layers = inject(APPLY_LAYERS),
    writer = inject(LAYER_WRITER),
    sets = inject(PENDING_SETS),
    history = inject(FILE_HISTORY),
  ) {
    this.#layers = layers;
    this.#writer = writer;
    this.#sets = sets;
    this.#history = history;
  }

  async run({ changes, parent, dryRun, fontAxes }: ApplyInput): Promise<ApplyOutput> {
    const run: Run = {
      dry: dryRun,
      changes,
      top: await this.#layers.top(parent),
      layers: new Map(),
      failed: new Map(),
      counterparts: new Counterparts(),
      origins: new Origins(),
      report: new ApplyReport(),
      sets: [],
    };

    await this.#writer.prepare(changes, dryRun, fontAxes);
    this.#sets.start(changes, dryRun);

    for (const change of changes) {
      try {
        await this.#change(change, run);
      } catch (error) {
        if (change.kind === APPLY_CHANGE_KIND.create) {
          // A new layer that failed is gone (or never made): its children must not find it in layers.
          if (!dryRun) {
            this.#layers.discard(run.layers.get(change.ref));
          }

          run.layers.delete(change.ref);
          run.failed.set(change.ref, change);
        }

        run.report.fail(change, error);
      }
    }

    if (!dryRun) {
      await this.#sets.settle(run);
      // Every layer made or written to, even when a step failed: the call is one undo step (T-121).
      this.#history.commitUndo();
    }

    return run.report.result(this.#sets.properties());
  }

  async #change(change: ApplyChangeData, run: Run): Promise<void> {
    const made = change.kind === APPLY_CHANGE_KIND.create && change.copyOf === undefined;
    const type = made ? NEW_LAYER_TYPE[change.tag] : undefined;

    // A new instance's component made earlier in the call is whole first: its set combined, its properties bound.
    if (type === FIGMA_NODE_TYPE.instance && !run.dry) {
      await this.#sets.settle(run, change);
    }

    const layer: TypedLayer = await this.#layers.of(change, run);

    run.layers.set(change.ref, layer);

    const placed = await this.#placed(layer, change, run);
    // A new set's variants wait in a plain frame until they combine: its checks are the set's, as a dry run's are.
    const checked: TypedLayer =
      type === FIGMA_NODE_TYPE.componentSet && !run.dry
        ? { type, parent: layer.parent ?? null, name: change.props.name }
        : layer;
    const refusals = this.#layers.refusals(checked, placed);

    refusals.push(...(await this.#writer.checks(placed, checked, refusals)));

    for (const { error, keys } of refusals) {
      run.report.fail(placed, error, keys);
    }

    if (run.dry) {
      run.report.planned(placed, (placed.moves ?? false) || this.#writes(placed, refusals));
    } else if (type === FIGMA_NODE_TYPE.componentSet) {
      this.#sets.hold(run, placed, layer as SceneNode, refusals);
    } else {
      await this.#sets.write(run, placed, layer as SceneNode, refusals);
    }
  }

  /**
   * The layer moved when its change says so; a move refused keeps it where it is, its error on before or after when
   * those placed it, and the change goes on without the move: its other attributes are still written (T-124, P-143).
   */
  async #placed(
    layer: TypedLayer,
    change: ApplyChangeData,
    run: Run,
  ): Promise<ApplyChangeData> {
    try {
      await this.#layers.move(layer, change, run);

      return change;
    } catch (error) {
      run.report.refusedMove(change, error);

      return { ...change, moves: false };
    }
  }

  /** Whether the change writes anything its checks left: a prop not refused, or its text. */
  #writes(change: ApplyChangeData, refusals: readonly Refusal[]): boolean {
    const refused = new Set(refusals.flatMap(({ keys, span }) => (span === undefined ? keys : [])));
    const props = Object.keys(change.props).some((key) => !refused.has(key as keyof typeof change.props));

    return props || (change.text !== undefined && !refusals.some(({ text }) => text ?? false));
  }
}

export const APPLY_RUN = new InjectionToken<ApplyRun>("ApplyRun");
