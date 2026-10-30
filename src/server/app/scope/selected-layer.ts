import { InjectionToken, injectable } from "@needle-di/core";
import { SELECTED_TEXT } from "@/server/app/scope/scope.constants.ts";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { selectionOp } from "@/shared/ops/selection/selection.manifest.ts";

/**
 * The one layer selected in Figma, for a tool whose layer defaults to it (T-051): one helper and one code for every such
 * tool (D-64), NODE_NOT_FOUND saying what to do when none or several are selected.
 */
@injectable()
export class SelectedLayer {
  async id(session: PluginSession): Promise<string> {
    const { nodes } = await session.run(selectionOp, {});
    const [only] = nodes;

    if (only === undefined || nodes.length > 1) {
      throw new PixelwrightError(
        ERROR_CODE.nodeNotFound,
        nodes.length === 0 ? SELECTED_TEXT.none : SELECTED_TEXT.several(nodes.length),
      );
    }

    return only.id;
  }

  /** Every layer selected, in order, for a tool whose layers default to the selection (inspect, measure). */
  async ids(session: PluginSession): Promise<string[]> {
    const { nodes } = await session.run(selectionOp, {});

    return nodes.map(({ id }) => id);
  }
}

export const SELECTED_LAYER = new InjectionToken<SelectedLayer>("SelectedLayer");
