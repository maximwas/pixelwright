import { inject, injectable } from "@needle-di/core";
import { READ_CATALOGUE } from "@/core/design/text/read-catalogue.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { FONT_SOURCES } from "@/server/tools/fonts-check/font-sources.ts";
import {
  type FontsChecked,
  type FontsCheckInput,
  FontsCheckInputSchema,
} from "@/server/tools/fonts-check/fonts-check.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";

/**
 * fonts_check (T-101): the layer given, or the one selected (T-051), read by the read op; its fonts as design_read's
 * JSON lists them (C-123), each with where the build gets it. Reads only.
 */
@injectable()
export class FontsCheckTool extends Tool<FontsCheckInput, FontsChecked> {
  protected readonly input = FontsCheckInputSchema;
  readonly #session;
  readonly #selected;
  readonly #catalogue;
  readonly #sources;

  constructor(
    session = inject(PLUGIN_SESSION),
    selected = inject(SELECTED_LAYER),
    catalogue = inject(READ_CATALOGUE),
    sources = inject(FONT_SOURCES),
  ) {
    super();
    this.#session = session;
    this.#selected = selected;
    this.#catalogue = catalogue;
    this.#sources = sources;
  }

  protected async run({ node }: FontsCheckInput): Promise<FontsChecked> {
    const id = node ?? (await this.#selected.id(this.#session));
    const {
      reads: [read],
    } = await this.#session.run(readOp, { nodes: [id] });

    if (read === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(id));
    }

    return await this.#sources.check(this.#catalogue.read(read).fonts);
  }
}
