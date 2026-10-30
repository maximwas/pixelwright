import { inject, injectable } from "@needle-di/core";
import type { InspectAnswer } from "@/core/inspect/inspect.schema.ts";
import { INSPECT_VIEW } from "@/core/inspect/inspect-view.ts";
import type { Point } from "@/core/kernel/geometry/area.ts";
import { SELECTED_LAYER } from "@/server/app/scope/selected-layer.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { INSPECT_TOOL_TEXT } from "@/server/tools/inspect/inspect.constants.ts";
import { InspectInputSchema, type InspectToolInput } from "@/server/tools/inspect/inspect.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { INSPECT } from "@/shared/ops/inspect/inspect.constants.ts";
import { inspectOp } from "@/shared/ops/inspect/inspect.manifest.ts";

/** Where the boxes start: relativeTo, or the page. */
type Origin = { readonly relativeTo?: string };

/**
 * Layers as Figma has them (A§9.3, T-080..T-083): those named, else the selection, the first 100 read by the inspect
 * op and the rest counted as `left` (O-014), put into words by core's InspectView; with `around`, measured from that
 * point, or from the centre of that layer read in the same origin by a second inspect beside the first (T-082).
 */
@injectable()
export class InspectTool extends Tool<InspectToolInput, InspectAnswer> {
  protected readonly input = InspectInputSchema;
  readonly #session;
  readonly #selected;
  readonly #view;

  constructor(
    session = inject(PLUGIN_SESSION),
    selected = inject(SELECTED_LAYER),
    view = inject(INSPECT_VIEW),
  ) {
    super();
    this.#session = session;
    this.#selected = selected;
    this.#view = view;
  }

  protected async run({ nodes, relativeTo, around }: InspectToolInput): Promise<InspectAnswer> {
    const ids = nodes ?? (await this.#selected.ids(this.#session));

    if (ids.length === 0) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, INSPECT_TOOL_TEXT.nothingSelected);
    }

    const origin: Origin = relativeTo === undefined ? {} : { relativeTo };
    const [raw, point] = await Promise.all([
      this.#session.run(inspectOp, { nodes: ids.slice(0, INSPECT.maxLayers), ...origin }),
      typeof around === "string" ? this.#centre(around, origin) : around,
    ]);
    const view = this.#view.build(raw, point);

    return ids.length > INSPECT.maxLayers ? { ...view, left: ids.length - INSPECT.maxLayers } : view;
  }

  /** The centre of the layer `around` names, from the origin the boxes are measured from. */
  async #centre(id: string, origin: Origin): Promise<Point> {
    const {
      layers: [layer],
    } = await this.#session.run(inspectOp, { nodes: [id], ...origin });

    if (layer === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, INSPECT_TOOL_TEXT.aroundMissing(id));
    }

    return this.#view.centre(layer.box);
  }
}
