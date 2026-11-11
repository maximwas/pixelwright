import { inject, injectable } from "@needle-di/core";
import type { ApplyReading } from "@/core/apply/apply.types.ts";
import { CurrentLayers } from "@/core/apply/plan/current-layers.ts";
import type { WritePlan } from "@/core/apply/plan/plan.types.ts";
import { WRITE_PLANNER } from "@/core/apply/plan/write-planner.ts";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE } from "@/server/app/stores/support-note.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import { DESIGN_APPLY_TEXT } from "@/server/tools/design-apply/design-apply.constants.ts";
import {
  type DesignApplyInput,
  DesignApplyInputSchema,
  type DesignApplyOutput,
} from "@/server/tools/design-apply/design-apply.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { READ_PROFILE } from "@/shared/read-model/read-model.constants.ts";

/** What prepare makes of the XML: the elements read and the plan the layers named give them. */
interface Prepared {
  readonly reading: ApplyReading;
  readonly plan: WritePlan;
}

/**
 * design_apply, its planning half (C-001..C-006, C-160..C-181): prepare reads the XML and fails with INVALID_XML at the
 * first fault, reads the layers it names with the apply profile and plans the changes; a dry run answers the elements,
 * every refusal and the changes, and a real run is refused until the writing half lands.
 */
@injectable()
export class DesignApplyTool extends WriteTool<DesignApplyInput, Prepared, DesignApplyOutput, DesignApplyOutput> {
  protected readonly input = DesignApplyInputSchema;
  // shortcut: a stand-in, the plainest read op, never reached while answerNow answers every call; the writing item
  // replaces it with design_apply's own op.
  protected readonly op = pingOp;
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

  protected async prepare({ xml, dryRun }: DesignApplyInput): Promise<Prepared> {
    const reading = new ApplyRead().read(xml);

    if (reading.invalidXml) {
      throw new PixelwrightError(ERROR_CODE.invalidXml, reading.errors[0]?.message ?? "");
    }

    if (!dryRun) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DESIGN_APPLY_TEXT.notYet);
    }

    const ids = this.#planner.layersToRead(reading.elements);
    const layers = ids.length === 0 ? CurrentLayers.of([], []) : await this.#read(ids);

    return { reading, plan: this.#planner.plan(reading.elements, layers) };
  }

  /** The layers the call names, read once with the apply profile (outermost first, one budget, the ids lacking listed). */
  async #read(nodes: string[]): Promise<CurrentLayers> {
    const { reads, missing } = await this.session.run(readOp, { nodes, profile: READ_PROFILE.apply });

    return CurrentLayers.of(reads, missing);
  }

  protected override answerNow({ reading, plan }: Prepared): DesignApplyOutput {
    const errors = [...reading.errors, ...plan.errors].toSorted(
      (first, second) => first.line - second.line || first.column - second.column,
    );

    const elements = reading.elements.map((element) => {
      const notWritten = plan.notWritten.get(element.ref);

      return notWritten === undefined ? element : { ...element, notWritten };
    });

    return { elements, errors, changes: plan.written, dry: true };
  }

  protected async write(): Promise<DesignApplyOutput> {
    throw new PixelwrightError(ERROR_CODE.opFailed, DESIGN_APPLY_TEXT.notYet);
  }

  protected changes(): number {
    return 0;
  }

  protected output(result: DesignApplyOutput, fields: WriterOutput): DesignApplyOutput {
    return { ...result, ...fields };
  }
}
