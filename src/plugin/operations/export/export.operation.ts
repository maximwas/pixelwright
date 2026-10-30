import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { CHUNK_STREAMS } from "@/plugin/app/streams/chunk-streams.ts";
import { EXPORT_CONSTRAINT, EXPORT_FIT, EXPORT_TEXT } from "@/plugin/operations/export/export.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { EXPORT_FORMAT } from "@/shared/ops/export/export.constants.ts";
import type { exportOp } from "@/shared/ops/export/export.manifest.ts";

type ExportInput = zod.output<typeof exportOp.input>;
type ExportOutput = zod.output<typeof exportOp.output>;

/**
 * A layer rendered by Figma's exportAsync (T-070) in PNG, JPG, SVG or PDF and held under the server's stream for chunk
 * (T-075): with its effects it covers what paints around its box (FX-062), without them its box alone; a raster's
 * scale lowered to fit maxSide.
 */
@injectable()
export class ExportOperation extends Operation<ExportInput, ExportOutput> {
  readonly #lookup;
  readonly #streams;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    streams = inject(CHUNK_STREAMS),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#streams = streams;
  }

  protected async execute({ node: id, format, scale, effects, maxSide, stream }: ExportInput): Promise<ExportOutput> {
    const node = await this.#lookup.existing(id);

    if (!("exportAsync" in node)) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, EXPORT_TEXT.notExportable(id, node.type));
    }

    const used = maxSide === undefined ? scale : this.#fitted(node, scale, effects, maxSide);
    const bytes = await node.exportAsync(this.#settings(format, used, effects));

    return { scale: used, totalBytes: this.#streams.hold(stream, bytes) };
  }

  /**
   * Figma's settings: a raster at the scale, a vector (SVG, PDF) at the layer's own size. useAbsoluteBounds: the layer's
   * own box, without the shadows and outside strokes that make it bigger.
   */
  #settings(
    format: ExportInput["format"],
    scale: number,
    effects: boolean,
  ): ExportSettings {
    return format === EXPORT_FORMAT.svg || format === EXPORT_FORMAT.pdf
      ? { format, useAbsoluteBounds: !effects }
      : { format, constraint: { type: EXPORT_CONSTRAINT.scale, value: scale }, useAbsoluteBounds: !effects };
  }

  /** The scale asked for, or lower so the rendered box (what paints, when effects are on) fits maxSide. */
  #fitted(
    node: BaseNode,
    asked: number,
    effects: boolean,
    maxSide: number,
  ): number {
    const painted = effects && "absoluteRenderBounds" in node ? node.absoluteRenderBounds : null;
    const box = painted ?? ("absoluteBoundingBox" in node ? node.absoluteBoundingBox : null);

    if (box === null) {
      return asked;
    }

    const side = Math.max(box.width, box.height) * asked;

    return side <= maxSide
      ? asked
      : Math.floor((maxSide / side) * asked * EXPORT_FIT.scaleSteps) / EXPORT_FIT.scaleSteps;
  }
}
