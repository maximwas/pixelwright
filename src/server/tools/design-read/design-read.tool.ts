import { inject, injectable } from "@needle-di/core";
import { AUTO_LINE_HEIGHTS } from "@/core/css/fonts/auto-line-heights.ts";
import { DESIGN_READER, type DesignAnswer } from "@/core/design/design-reader.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolAnswer } from "@/server/app/tool-runner/tool-runner.ts";
import { DESIGN_READ_LINE_HEIGHT, DESIGN_READ_TEXT } from "@/server/tools/design-read/design-read.constants.ts";
import { type DesignReadInput, DesignReadInputSchema } from "@/server/tools/design-read/design-read.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { nearbyOp } from "@/shared/ops/nearby/nearby.manifest.ts";
import type { NearbyNotesOutput } from "@/shared/ops/nearby/nearby.schema.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";

/** design_read's answer: the XML, and the JSON beside it. */
type DesignReadOutput = {
  readonly xml: string;
  readonly json: { readonly node: string } & Omit<DesignAnswer, "xml"> & { readonly nearby?: NearbyNotesOutput };
};

/**
 * A layer as design XML (A§6.1), with the text styles and fonts it uses in the JSON (C-123): the one selected when no node is given (T-051), read by the plugin's read op as the
 * read model (T-053), refused when hidden (T-052), written by core's DesignReader: fit to maxChars (T-054), runs
 * folded when asked (T-059), its Auto line heights in px when asked (T-060); the JSON's hints and measurements (T-061)
 * and, when asked, the designer's notes around the screen (T-058).
 */
@injectable()
export class DesignReadTool extends Tool<DesignReadInput, DesignReadOutput> {
  protected readonly input = DesignReadInputSchema;
  readonly #session;
  readonly #selected;
  readonly #reader;
  readonly #lines;

  constructor(
    session = inject(PLUGIN_SESSION),
    selected = inject(SELECTED_LAYER),
    reader = inject(DESIGN_READER),
    lines = inject(AUTO_LINE_HEIGHTS),
  ) {
    super();
    this.#session = session;
    this.#selected = selected;
    this.#reader = reader;
    this.#lines = lines;
  }

  protected async run(input: DesignReadInput): Promise<DesignReadOutput> {
    const { node, depth, maxChars, repeats, autoLineHeight, nearby } = input;
    const id = node ?? (await this.#selected.id(this.#session));
    const {
      reads: [read],
    } = await this.#session.run(readOp, { nodes: [id], ...(depth === undefined ? {} : { depth }) });

    if (read === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(id));
    }

    if (!read.root.visible) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DESIGN_READ_TEXT.hidden(id));
    }

    const model = autoLineHeight === DESIGN_READ_LINE_HEIGHT.px ? this.#lines.px(read) : read;
    const { xml, ...json } = this.#reader.read(model, { maxChars, repeats });
    const notes = nearby === undefined ? null : await this.#nearby(id, nearby);

    return { xml, json: { node: id, ...json, ...(notes === null ? {} : { nearby: notes }) } };
  }

  /** The notes around the screen holding the layer (T-058); a plugin too old for the op is told to update. */
  async #nearby(node: string, distance: number): Promise<NearbyNotesOutput> {
    try {
      return await this.#session.run(nearbyOp, { node, distance });
    } catch (error) {
      if (error instanceof PixelwrightError && error.code === ERROR_CODE.unknownOp) {
        throw new PixelwrightError(ERROR_CODE.unknownOp, DESIGN_READ_TEXT.oldPlugin, { cause: error });
      }

      throw error;
    }
  }

  /** Two text blocks and no structuredContent (T-005, FX-067): the XML, then the JSON. */
  protected override answer({ xml, json }: DesignReadOutput): ToolAnswer {
    return {
      content: [
        { type: TOOL_CONTENT_TYPE.text, text: xml },
        { type: TOOL_CONTENT_TYPE.text, text: JSON.stringify(json) },
      ],
    };
  }
}
