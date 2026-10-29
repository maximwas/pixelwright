import { inject, injectable } from "@needle-di/core";
import { DESIGN_XML } from "@/core/design/design-xml.ts";
import { type Catalogue, READ_CATALOGUE } from "@/core/design/text/read-catalogue.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolAnswer } from "@/server/app/tool-runner/tool-runner.ts";
import { DESIGN_READ_TEXT } from "@/server/tools/design-read/design-read.constants.ts";
import { type DesignReadInput, DesignReadInputSchema } from "@/server/tools/design-read/design-read.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";

/** design_read's answer: the XML, and the JSON beside it. */
type DesignReadOutput = {
  readonly xml: string;
  readonly json: { readonly node: string; readonly truncated: readonly string[] } & Catalogue;
};

/**
 * A layer as design XML (A§6.1), with the text styles and fonts it uses in the JSON (C-123): the one selected when no node is given (T-051), read by the plugin's read op as the
 * read model (T-053), refused when hidden (T-052), written by core's DesignXml.
 */
@injectable()
export class DesignReadTool extends Tool<DesignReadInput, DesignReadOutput> {
  protected readonly input = DesignReadInputSchema;
  readonly #session;
  readonly #selected;
  readonly #design;
  readonly #catalogue;

  constructor(
    session = inject(PLUGIN_SESSION),
    selected = inject(SELECTED_LAYER),
    design = inject(DESIGN_XML),
    catalogue = inject(READ_CATALOGUE),
  ) {
    super();
    this.#session = session;
    this.#selected = selected;
    this.#design = design;
    this.#catalogue = catalogue;
  }

  protected async run({ node, depth }: DesignReadInput): Promise<DesignReadOutput> {
    const id = node ?? (await this.#selected.id(this.#session));
    const {
      reads: [read],
      cuts,
    } = await this.#session.run(readOp, { nodes: [id], ...(depth === undefined ? {} : { depth }) });

    if (read === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(id));
    }

    if (!read.root.visible) {
      throw new PixelwrightError(ERROR_CODE.opFailed, DESIGN_READ_TEXT.hidden(id));
    }

    return {
      xml: this.#design.xml(read),
      json: { node: id, truncated: cuts.map((cut) => cut.id), ...this.#catalogue.read(read) },
    };
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
