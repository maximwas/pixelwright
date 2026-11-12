import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { NEW_LAYER_TYPE } from "@/plugin/operations/apply/apply.constants.ts";
import type { ApplyCall } from "@/plugin/operations/apply/apply.types.ts";
import { APPLY_LAYERS } from "@/plugin/operations/apply/apply-layers.ts";
import { APPLY_CHECKS, type Refusal } from "@/plugin/operations/apply/checks.ts";
import { Counterparts } from "@/plugin/operations/apply/counterparts.ts";
import { ApplyReport } from "@/plugin/operations/apply/report.ts";
import { LAYER_WRITER } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { applyOp } from "@/shared/ops/apply/apply.manifest.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

export type ApplyInput = zod.output<typeof applyOp.input>;

export type ApplyOutput = zod.output<typeof applyOp.output>;

/** A new set waiting for its variants: written once they are combined. */
interface PendingSet {
  readonly change: ApplyChangeData;
  readonly holder: SceneNode;
  readonly refusals: Refusal[];
}

/** One call's state: the call's, with its report and the sets to combine. */
interface Run extends ApplyCall {
  readonly report: ApplyReport;
  readonly sets: PendingSet[];
}

/**
 * design_apply's changes in Figma (T-121, A§6.2 step 7), element by element in document order, so one that fails
 * leaves the others: each layer found or made, checked, then written on a real run; a dry run runs the same checks and
 * writes nothing. New component sets wait for their variants. One undo step closes a real call.
 */
@injectable()
export class ApplyRun {
  readonly #checks;
  readonly #writer;
  readonly #layers;
  readonly #history;

  constructor(
    checks = inject(APPLY_CHECKS),
    writer = inject(LAYER_WRITER),
    layers = inject(APPLY_LAYERS),
    history = inject(FILE_HISTORY),
  ) {
    this.#checks = checks;
    this.#writer = writer;
    this.#layers = layers;
    this.#history = history;
  }

  async run({ changes, parent, dryRun }: ApplyInput): Promise<ApplyOutput> {
    const run: Run = {
      dry: dryRun,
      changes,
      top: await this.#checks.top(parent),
      layers: new Map(),
      failed: new Map(),
      counterparts: new Counterparts(),
      report: new ApplyReport(),
      sets: [],
    };

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
      await this.#settle(run);
      // Every layer made or written to, even when a step failed: the call is one undo step (T-121).
      this.#history.commitUndo();
    }

    return run.report.result();
  }

  async #change(change: ApplyChangeData, run: Run): Promise<void> {
    const create = change.kind === APPLY_CHANGE_KIND.create;
    const layer: TypedLayer = await this.#layers.of(change, run);

    run.layers.set(change.ref, layer);

    const refusals = this.#checks.refusals(layer, change);

    refusals.push(...(await this.#writer.checks(change, layer, refusals)));

    for (const { error, keys } of refusals) {
      run.report.fail(change, error, keys);
    }

    if (run.dry) {
      run.report.planned(change, (change.moves ?? false) || this.#writes(change, refusals));
    } else if (create && NEW_LAYER_TYPE[change.tag] === FIGMA_NODE_TYPE.componentSet) {
      run.sets.push({ change, holder: layer as SceneNode, refusals });
    } else {
      await this.#write(change, layer as SceneNode, refusals, run);
    }
  }

  async #write(
    change: ApplyChangeData,
    node: SceneNode,
    refusals: Refusal[],
    run: Run,
  ): Promise<void> {
    const wrote = await this.#writer.write(node, change, refusals, (error, keys) =>
      run.report.fail(change, error, keys),
    );

    if (change.kind === APPLY_CHANGE_KIND.create) {
      this.#layers.finish(node, change);
      run.report.made(change, node);
    } else if (wrote || (change.moves ?? false)) {
      run.report.wroteTo(node.id);
    }
  }

  /** Each new set made of the Components written into its frame, then written itself. */
  async #settle(run: Run): Promise<void> {
    for (const { change, holder, refusals } of run.sets) {
      try {
        await this.#write(change, this.#layers.combine(holder), refusals, run);
      } catch (error) {
        run.report.fail(change, error);
      }
    }
  }

  /** Whether the change writes anything its checks left: a prop not refused, or its text. */
  #writes(change: ApplyChangeData, refusals: readonly Refusal[]): boolean {
    const refused = new Set(refusals.flatMap(({ keys }) => keys));
    const props = Object.keys(change.props).some((key) => !refused.has(key as keyof typeof change.props));

    return props || (change.text !== undefined && !refusals.some(({ text }) => text ?? false));
  }
}

export const APPLY_RUN = new InjectionToken<ApplyRun>("ApplyRun");
