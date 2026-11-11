import { injectable } from "@needle-di/core";
import type { ApplyReading } from "@/core/apply/apply.types.ts";
import { ApplyRead } from "@/core/apply/read/apply-read.ts";
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

/**
 * design_apply, its reading half (C-001..C-006, C-160..C-166): prepare reads the XML and fails with INVALID_XML at the
 * first fault; a dry run answers the elements it read and every refusal, and a real run is refused until the writing
 * half lands.
 */
@injectable()
export class DesignApplyTool extends WriteTool<DesignApplyInput, ApplyReading, DesignApplyOutput, DesignApplyOutput> {
  protected readonly input = DesignApplyInputSchema;
  // shortcut: a stand-in, the plainest read op, never reached while answerNow answers every call; the writing item
  // replaces it with design_apply's own op.
  protected readonly op = pingOp;

  protected async prepare({ xml, dryRun }: DesignApplyInput): Promise<ApplyReading> {
    const reading = new ApplyRead().read(xml);

    if (reading.invalidXml) {
      throw new PixelwrightError(ERROR_CODE.invalidXml, reading.errors[0]?.message ?? "");
    }

    if (!dryRun) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DESIGN_APPLY_TEXT.notYet);
    }

    return reading;
  }

  protected override answerNow({ elements, errors }: ApplyReading): DesignApplyOutput {
    return { elements, errors, dry: true };
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
