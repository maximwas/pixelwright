import { inject, injectable } from "@needle-di/core";
import { MEASURED } from "@/core/inspect/inspect.constants.ts";
import type { MeasureAnswer } from "@/core/inspect/inspect.schema.ts";
import { MEASURE as MEASURER } from "@/core/inspect/measure.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { MEASURE, MEASURE_TOOL_TEXT } from "@/server/tools/measure/measure.constants.ts";
import { type MeasureInput, MeasureInputSchema } from "@/server/tools/measure/measure.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { INSPECT } from "@/shared/ops/inspect/inspect.constants.ts";
import { inspectOp } from "@/shared/ops/inspect/inspect.manifest.ts";

/**
 * The distances between layers (T-084): those named, else the selection, in order, read by the inspect op in page px
 * and measured by core's Measure, each from the one before. Fewer than two layers found is an error.
 */
@injectable()
export class MeasureTool extends Tool<MeasureInput, MeasureAnswer> {
  protected readonly input = MeasureInputSchema;
  readonly #session;
  readonly #selected;
  readonly #measure;

  constructor(
    session = inject(PLUGIN_SESSION),
    selected = inject(SELECTED_LAYER),
    measure = inject(MEASURER),
  ) {
    super();
    this.#session = session;
    this.#selected = selected;
    this.#measure = measure;
  }

  protected async run({ nodes, painted }: MeasureInput): Promise<MeasureAnswer> {
    const ids = nodes ?? (await this.#selected.ids(this.#session));
    const raw =
      ids.length === 0 ? null : await this.#session.run(inspectOp, { nodes: ids.slice(0, INSPECT.maxLayers) });
    const layers = raw?.layers ?? [];

    if (raw === null || layers.length < MEASURE.minLayers) {
      throw new PixelwrightError(ERROR_CODE.opFailed, MEASURE_TOOL_TEXT.tooFew(layers.length, ids));
    }

    return {
      measured: painted ? MEASURED.painted : MEASURED.box,
      pairs: this.#measure.pairs(layers, painted),
      missing: raw.missing,
    };
  }
}
