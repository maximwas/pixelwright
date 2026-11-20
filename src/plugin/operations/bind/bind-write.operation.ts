import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { FILE_HISTORY } from "@/plugin/adapters/figma/file-history.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { BIND_WRITE } from "@/plugin/operations/bind/bind.constants.ts";
import type { BindRun } from "@/plugin/operations/bind/bind-targets.ts";
import { REMAP_WRITER } from "@/plugin/operations/bind/remap-writer.ts";
import { USE_BINDER } from "@/plugin/operations/bind/use-binder.ts";
import type { bindWriteOp } from "@/shared/ops/bind/bind-write.manifest.ts";

type BindWriteInput = zod.output<typeof bindWriteOp.input>;

type BindWriteOutput = zod.output<typeof bindWriteOp.output>;

type Failure = BindWriteOutput["failed"][number];

/**
 * The bind_write op (T-167, P-164): tokens_bind's plan written in Figma, every planned use bound where the scan found
 * it, then every rebind; what Figma refuses is that layer's failure, with its reason, while the rest is bound, and
 * everything written is one undo step, a call stopped halfway too. It binds what the plan holds and nothing more: the
 * scan kept to its 2,000 layers (R-039). Allow edits is checked before it runs (P-010).
 */
@injectable()
export class BindWriteOperation extends Operation<BindWriteInput, BindWriteOutput> {
  readonly #uses;
  readonly #remaps;
  readonly #history;

  constructor(
    report = inject(OP_REPORT),
    uses = inject(USE_BINDER),
    remaps = inject(REMAP_WRITER),
    history = inject(FILE_HISTORY),
  ) {
    super(report);
    this.#uses = uses;
    this.#remaps = remaps;
    this.#history = history;
  }

  protected async execute(plan: BindWriteInput): Promise<BindWriteOutput> {
    const run: BindRun = { layers: new Map(), variables: new Map(), styles: new Map() };
    const failed = new Map<string, Failure>();

    try {
      for (const planned of plan.binds) {
        await this.#attempt(planned.layer, failed, () => this.#uses.bind(planned, run));
      }

      for (const remap of plan.remaps) {
        await this.#attempt(remap.layer, failed, () => this.#remaps.remap(remap, run));
      }
    } finally {
      this.#history.commitUndo();
    }

    return { failed: [...failed.values()].slice(0, BIND_WRITE.maxFailed) };
  }

  protected override touched(_output: BindWriteOutput, { binds, remaps }: BindWriteInput): readonly string[] {
    return [...new Set([...binds, ...remaps].map(({ layer }) => layer))];
  }

  /** One write; what Figma throws is its layer's failure, once per reason. */
  async #attempt(
    layer: string,
    failed: Map<string, Failure>,
    write: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await write();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      failed.set([layer, message].join(BIND_WRITE.keyJoint), { id: layer, message });
    }
  }
}
