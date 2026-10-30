import { inject, injectable } from "@needle-di/core";
import { DESIGN_READER, type DesignAnswer } from "@/core/design/design-reader.ts";
import type { AssetError } from "@/server/app/assets/assets.types.ts";
import type { Shot } from "@/server/app/renders/shot.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { TOOL_CONTENT_TYPE } from "@/server/app/tool-runner/tool-content.constants.ts";
import type { ToolAnswer } from "@/server/app/tool-runner/tool-runner.ts";
import { DESIGN_READ_TEXT } from "@/server/tools/design-read/design-read.constants.ts";
import { type DesignReadInput, DesignReadInputSchema } from "@/server/tools/design-read/design-read.schema.ts";
import { DESIGN_READ_EXTRAS } from "@/server/tools/design-read/design-read-extras.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import type { NearbyNotesOutput } from "@/shared/ops/nearby/nearby.schema.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";

/** design_read's answer: the XML, the JSON beside it, and the layer's image when asked. */
type DesignReadOutput = {
  readonly xml: string;
  readonly json: { readonly node: string } & Omit<DesignAnswer, "xml"> & {
    readonly written?: boolean;
    readonly assetErrors?: readonly AssetError[];
    readonly nearby?: NearbyNotesOutput;
  };
  readonly shot?: Shot;
};

/**
 * A layer as design XML (A§6.1), with the text styles and fonts it uses in the JSON (C-123): the one selected when no node is given (T-051), read by the plugin's read op as the
 * read model (T-053), refused when hidden (T-052), written by core's DesignReader: fit to maxChars (T-054), runs
 * folded when asked (T-059), its Auto line heights in px when asked (T-060); the JSON's hints and measurements (T-061)
 * and, when asked, the designer's notes around the screen (T-058) and the layer's image (T-056). With assetsDir its
 * assets are written and each src names its file; without it the JSON says the names are plans (T-055).
 */
@injectable()
export class DesignReadTool extends Tool<DesignReadInput, DesignReadOutput> {
  protected readonly input = DesignReadInputSchema;
  readonly #session;
  readonly #selected;
  readonly #reader;
  readonly #extras;

  constructor(
    session = inject(PLUGIN_SESSION),
    selected = inject(SELECTED_LAYER),
    reader = inject(DESIGN_READER),
    extras = inject(DESIGN_READ_EXTRAS),
  ) {
    super();
    this.#session = session;
    this.#selected = selected;
    this.#reader = reader;
    this.#extras = extras;
  }

  protected async run(input: DesignReadInput): Promise<DesignReadOutput> {
    const { node, depth, maxChars, repeats, autoLineHeight, nearby, screenshot, assetsDir } = input;
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

    const model = this.#extras.model(read, autoLineHeight);
    const assets = await this.#extras.assets(this.#session, model, assetsDir);
    const { xml, ...json } = this.#reader.read(model, { maxChars, repeats, assets: assets.plan });
    const notes = nearby === undefined ? null : await this.#extras.nearby(this.#session, id, nearby);
    const shot = screenshot ? await this.#extras.screenshot(this.#session, id) : null;

    return {
      xml,
      json: {
        node: id,
        ...json,
        // The hint joins the read's hints in place; written: false says every src is a plan.
        ...(assets.hint === undefined ? {} : { hints: [...json.hints, assets.hint], written: false }),
        ...(assets.errors === undefined ? {} : { assetErrors: assets.errors }),
        ...(notes === null ? {} : { nearby: notes }),
      },
      ...(shot === null ? {} : { shot }),
    };
  }

  /** Two text blocks and no structuredContent (T-005, FX-067): the XML, then the JSON; then the image and its line. */
  protected override answer({ xml, json, shot }: DesignReadOutput): ToolAnswer {
    return {
      content: [
        { type: TOOL_CONTENT_TYPE.text, text: xml },
        { type: TOOL_CONTENT_TYPE.text, text: JSON.stringify(json) },
        ...(shot === undefined ? [] : shot.blocks()),
      ],
    };
  }
}
