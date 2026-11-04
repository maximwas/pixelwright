import { InjectionToken, injectable } from "@needle-di/core";
import type { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import type { BaselineFile } from "@/server/app/stores/stores.schema.ts";
import {
  BASELINE_DIFF_TEXT,
  BASELINE_LOOKUP,
  BASELINE_STATUS,
} from "@/server/tools/baseline-diff/baseline-diff.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { findOp } from "@/shared/ops/find/find.manifest.ts";
import { outlineOp } from "@/shared/ops/outline/outline.manifest.ts";

/** A layer compared instead of the baseline's own. */
export interface LayerNow {
  readonly id: string;
  readonly name: string;
}

/** Where a baseline's layer is now: the id to compare (and the layer when not its own), or why it cannot be. */
export type RootNow =
  | { readonly id: string; readonly now?: LayerNow; readonly notes: string[] }
  | { readonly status: typeof BASELINE_STATUS.missing | typeof BASELINE_STATUS.unavailable; readonly reason: string };

/** The layers a find answered, as the root's look-alikes. */
type Found = { readonly id: string; readonly name: string; readonly type: string }[];

/**
 * The layer a baseline is compared with (T-206): `node` when given; else its own id; a gone one found again by its
 * exact name and type on its page (the current page when that page is gone too), when exactly one layer has them,
 * else missing with three look-alikes. An id that now names a layer of another type and another name means another
 * file: unavailable.
 */
@injectable()
export class BaselineRoot {
  async locate(
    session: PluginSession,
    baseline: BaselineFile,
    node: string | undefined,
  ): Promise<RootNow> {
    if (node !== undefined) {
      return { id: node, notes: [] };
    }

    const { id, name, type } = baseline.node;
    const stored = await this.#layerAt(session, id);

    if (stored === null) {
      return this.#byName(session, baseline);
    }

    if (stored.type !== type && stored.name !== name) {
      return {
        status: BASELINE_STATUS.unavailable,
        reason: BASELINE_DIFF_TEXT.otherLayer(id, baseline.file.name, stored, type),
      };
    }

    return { id, notes: [] };
  }

  /** The layer at an id, as an outline names it; null when the file has none. */
  async #layerAt(session: PluginSession, id: string): Promise<{ name: string; type: string } | null> {
    try {
      const { root } = await session.run(outlineOp, { node: id, depth: BASELINE_LOOKUP.depth });

      return root;
    } catch (error) {
      if (this.#gone(error)) {
        return null;
      }

      throw error;
    }
  }

  async #byName(session: PluginSession, baseline: BaselineFile): Promise<RootNow> {
    const found = await this.#lookAlikes(session, baseline);
    const exact = found.filter(({ name, type }) => name === baseline.node.name && type === baseline.node.type);
    const [only, second] = exact;

    if (only !== undefined && second === undefined) {
      return {
        id: only.id,
        now: { id: only.id, name: only.name },
        notes: [BASELINE_DIFF_TEXT.foundAgain(baseline.node.id, only.name, only.id)],
      };
    }

    const named = (exact.length === 0 ? found : exact)
      .slice(0, BASELINE_LOOKUP.lookAlikes)
      .map(({ name, id }) => BASELINE_DIFF_TEXT.lookAlike(name, id));

    return { status: BASELINE_STATUS.missing, reason: BASELINE_DIFF_TEXT.gone(baseline.node, named, baseline.name) };
  }

  /** The layers named like the root on its page; on the current page when its page was deleted with it. */
  async #lookAlikes(session: PluginSession, baseline: BaselineFile): Promise<Found> {
    const query = { name: baseline.node.name, type: baseline.node.type, limit: BASELINE_LOOKUP.limit };

    if (baseline.page === null) {
      return (await session.run(findOp, query)).nodes;
    }

    try {
      return (await session.run(findOp, { ...query, within: baseline.page.id })).nodes;
    } catch (error) {
      if (this.#gone(error)) {
        return (await session.run(findOp, query)).nodes;
      }

      throw error;
    }
  }

  #gone(error: unknown): boolean {
    return error instanceof PixelwrightError && error.code === ERROR_CODE.nodeNotFound;
  }
}

export const BASELINE_ROOT = new InjectionToken<BaselineRoot>("BaselineRoot");
