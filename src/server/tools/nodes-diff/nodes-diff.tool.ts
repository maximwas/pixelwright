import { inject, injectable } from "@needle-di/core";
import { DESIGN_DIFF } from "@/core/diff/design-diff.ts";
import { DIFF } from "@/core/diff/diff.constants.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { NODES_DIFF_TEXT } from "@/server/tools/nodes-diff/nodes-diff.constants.ts";
import {
  type NodesDiffAnswer,
  type NodesDiffInput,
  NodesDiffInputSchema,
} from "@/server/tools/nodes-diff/nodes-diff.schema.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { NODE_TEXT } from "@/shared/errors/errors.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

/**
 * nodes_diff (T-085): both layers read by one read op, so from one file even if the user switches files, compared by
 * core's DesignDiff; each list cut to DIFF.maxEntries, `more` counting the rest. Reads only.
 */
@injectable()
export class NodesDiffTool extends Tool<NodesDiffInput, NodesDiffAnswer> {
  protected readonly input = NodesDiffInputSchema;
  readonly #session;
  readonly #diff;

  constructor(session = inject(PLUGIN_SESSION), diff = inject(DESIGN_DIFF)) {
    super();
    this.#session = session;
    this.#diff = diff;
  }

  protected async run({ a, b, depth }: NodesDiffInput): Promise<NodesDiffAnswer> {
    const { reads } = await this.#session.run(readOp, { nodes: [a, b], ...(depth === undefined ? {} : { depth }) });
    const left = this.#read(reads, a);
    const right = this.#read(reads, b);
    const { same, onlyInA, onlyInB, changed } = this.#diff.diff(left, right);
    const more = [onlyInA, onlyInB, changed].reduce((sum, list) => sum + Math.max(0, list.length - DIFF.maxEntries), 0);
    const named = [this.#named(left), this.#named(right)] as const;
    const counts = { changed: changed.length, onlyInA: onlyInA.length, onlyInB: onlyInB.length };

    return {
      same,
      onlyInA: onlyInA.slice(0, DIFF.maxEntries),
      onlyInB: onlyInB.slice(0, DIFF.maxEntries),
      changed: changed.slice(0, DIFF.maxEntries),
      summary: same ? NODES_DIFF_TEXT.same(...named) : NODES_DIFF_TEXT.differs(...named, counts),
      ...(more === 0 ? {} : { more }),
    };
  }

  #read(reads: readonly ReadModel[], id: string): ReadModel {
    const found = reads.find(({ root }) => root.id === id);

    if (found === undefined) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NODE_TEXT.notFound(id));
    }

    return found;
  }

  #named({ root }: ReadModel): string {
    return NODES_DIFF_TEXT.named(root.id, root.name);
  }
}
