import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT, NEW_LAYER_TYPE } from "@/plugin/operations/apply/apply.constants.ts";
import { APPLY_CHECKS, type Refusal } from "@/plugin/operations/apply/checks.ts";
import { NEW_LAYERS } from "@/plugin/operations/apply/new-layers.ts";
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

/** One call's state: dry or real, where top-level layers go, the layers by ref, the report, the sets to combine. */
interface Run {
  readonly dry: boolean;
  readonly top: BaseNode;
  readonly layers: Map<string, TypedLayer>;
  /** The new layers whose creation failed, by ref: a child names its parent from here. */
  readonly failed: Map<string, ApplyChangeData>;
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
    layers = inject(NEW_LAYERS),
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
      top: await this.#checks.top(parent),
      layers: new Map(),
      failed: new Map(),
      report: new ApplyReport(),
      sets: [],
    };

    for (const change of changes) {
      try {
        await this.#change(change, run);
      } catch (error) {
        if (change.kind === APPLY_CHANGE_KIND.create) {
          // A new layer that failed is gone (or never made): its children must not find it in layers.
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
    const layer = create ? await this.#created(change, run) : await this.#checks.existing(change, !run.dry);

    run.layers.set(change.ref, layer);

    const refusals = this.#checks.refusals(layer, change);

    for (const { error, keys } of refusals) {
      run.report.fail(change, error, keys);
    }

    if (run.dry) {
      run.report.planned(change, this.#writes(change, refusals));
    } else if (create && NEW_LAYER_TYPE[change.tag] === FIGMA_NODE_TYPE.componentSet) {
      run.sets.push({ change, holder: layer as SceneNode, refusals });
    } else {
      await this.#write(change, layer as SceneNode, refusals, run);
    }
  }

  /** A new layer's place checked, and on a real run the layer made there; a dry run knows its type alone. */
  async #created(change: ApplyChangeData, run: Run): Promise<TypedLayer> {
    const parent = change.parent === null ? run.top : run.layers.get(change.parent);

    if (parent === undefined) {
      const failed = change.parent === null ? undefined : run.failed.get(change.parent);

      throw new WriteError(
        failed === undefined ? APPLY_TEXT.noParent : APPLY_TEXT.parentFailed(failed.tag, failed.line),
      );
    }

    const type = this.#checks.creatable(change, parent);

    return run.dry ? { type } : this.#layers.create(type, change, parent as BaseNode);
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
      this.#layers.finish(node, change.props);
      run.report.made(change, node);
    } else if (wrote) {
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
