import { injectable } from "@needle-di/core";
import { XML_NODE_KIND } from "@/core/xml/parse/parse.constants.ts";
import type { XmlNode } from "@/core/xml/parse/parse.types.ts";
import { XmlParser } from "@/core/xml/parse/xml-parser.ts";
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
import { deleteOp } from "@/shared/ops/delete/delete.manifest.ts";

/** What prepare read: how many elements. */
interface Read {
  readonly elements: number;
}

/**
 * design_apply, its strict XML half (C-001..C-006): prepare parses and fails with INVALID_XML at the first fault; good
 * XML in a dry run is answered as accepted, and a real run is refused until the writing half lands.
 */
@injectable()
export class DesignApplyTool extends WriteTool<DesignApplyInput, Read, DesignApplyOutput, DesignApplyOutput> {
  protected readonly input = DesignApplyInputSchema;
  // shortcut: a stand-in, never reached while answerNow answers every call; the writing item gives design_apply its op.
  protected readonly op = deleteOp;

  protected async prepare({ xml, dryRun }: DesignApplyInput): Promise<Read> {
    const parsed = new XmlParser().parse(xml);

    if (!parsed.ok) {
      throw new PixelwrightError(ERROR_CODE.invalidXml, parsed.error.message);
    }

    if (!dryRun) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DESIGN_APPLY_TEXT.notYet);
    }

    return { elements: this.#count(parsed.nodes) };
  }

  protected override answerNow({ elements }: Read): DesignApplyOutput {
    return { elements, dry: true };
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

  #count(nodes: readonly XmlNode[]): number {
    return nodes.reduce(
      (total, node) => (node.kind === XML_NODE_KIND.element ? total + 1 + this.#count(node.children) : total),
      0,
    );
  }
}
