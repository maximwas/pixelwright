import { inject, injectable } from "@needle-di/core";
import type { ApplyError, ApplyReading } from "@/core/apply/apply.types.ts";
import { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import type { WritePlan } from "@/core/apply/plan/plan.types.ts";
import { WRITE_PLANNER } from "@/core/apply/plan/write-planner.ts";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import {
  type DesignApplyInput,
  DesignApplyInputSchema,
  type DesignApplyOutput,
} from "@/server/tools/design-apply/design-apply.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { applyOp } from "@/shared/ops/apply/apply.manifest.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { READ_PROFILE } from "@/shared/read-model/read-model.constants.ts";

/** What prepare makes of the XML: the elements read, the plan the layers named give them, where new layers go. */
interface Prepared {
  readonly reading: ApplyReading;
  readonly plan: WritePlan;
  readonly parent: string | undefined;
  readonly dryRun: boolean;
}

/** The part of the answer the plan and the plugin's errors make together. */
type Answered = Pick<DesignApplyOutput, "elements" | "errors" | "changes">;

/**
 * design_apply (T-120..T-123, C-001..C-181): prepare reads the XML and fails with INVALID_XML at the first fault, reads
 * the layers it names with the apply profile and plans the changes once for dry and real runs (T-142); nothing to
 * write answers at once, else the plan goes to the plugin's apply op through the versioned write (D-41).
 */
@injectable()
export class DesignApplyTool extends WriteTool<DesignApplyInput, Prepared, DesignApplyOutput, DesignApplyOutput> {
  protected readonly input = DesignApplyInputSchema;
  protected readonly op = applyOp;
  readonly #planner;

  constructor(
    session = inject(PLUGIN_SESSION),
    versioned = inject(VERSIONED_WRITE),
    support = inject(SUPPORT_NOTE),
    planner = inject(WRITE_PLANNER),
  ) {
    super(session, versioned, support);
    this.#planner = planner;
  }

  protected async prepare({ xml, parent, dryRun }: DesignApplyInput): Promise<Prepared> {
    const reading = new ApplyRead().read(xml);

    if (reading.invalidXml) {
      throw new PixelwrightError(ERROR_CODE.invalidXml, reading.errors[0]?.message ?? "");
    }

    const ids = this.#planner.layersToRead(reading.elements);
    const layers = ids.length === 0 ? CurrentLayers.of([], []) : await this.#read(ids);

    return { reading, plan: this.#planner.plan(reading.elements, layers), parent, dryRun };
  }

  /** The layers the call names, read once with the apply profile (outermost first, one budget, the ids lacking listed). */
  async #read(nodes: string[]): Promise<CurrentLayers> {
    const { reads, missing } = await this.session.run(readOp, { nodes, profile: READ_PROFILE.apply });

    return CurrentLayers.of(reads, missing);
  }

  /** Nothing writes: the plan's answer, no plugin write and no version. */
  protected override answerNow(prepared: Prepared): DesignApplyOutput | undefined {
    if (prepared.plan.written.length > 0) {
      return undefined;
    }

    return {
      ...this.#answer(prepared, []),
      created: [],
      changed: [],
      ...(prepared.dryRun ? { dry: true as const } : {}),
    };
  }

  protected async write(prepared: Prepared, dry: boolean): Promise<DesignApplyOutput> {
    const { plan, parent } = prepared;
    const applied = await this.session.run(applyOp, {
      changes: plan.send,
      ...(parent === undefined ? {} : { parent }),
      dryRun: dry,
    });

    return { ...this.#answer(prepared, applied.errors), created: applied.created, changed: applied.changed };
  }

  protected changes({ created, changed }: DesignApplyOutput): number {
    return created.length + changed.length;
  }

  protected output(result: DesignApplyOutput, fields: WriterOutput): DesignApplyOutput {
    return { ...result, ...fields };
  }

  /** The elements read, every error in the XML's order (the plugin's with the reader's and the planner's), the changes. */
  #answer({ reading, plan }: Prepared, applied: ApplyError[]): Answered {
    const errors = [...reading.errors, ...plan.errors, ...applied].toSorted(
      (first, second) => first.line - second.line || first.column - second.column,
    );
    const elements = reading.elements.map((element) => {
      const notWritten = plan.notWritten.get(element.ref);

      return notWritten === undefined ? element : { ...element, notWritten };
    });
    // The planner's placement keys (index, before, after, copyOf, source, copy) are for the write; the declared schema
    // lists none of them, so the answer names the listed keys one by one instead of relying on a strip.
    const changes = plan.written.map(({ line, column, kind, id, ref, tag, parent, props, sources, text }) => ({
      line,
      column,
      kind,
      id,
      ref,
      tag,
      parent,
      props,
      sources,
      ...(text === undefined ? {} : { text }),
    }));

    return { elements, errors, changes };
  }
}
