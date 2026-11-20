import { injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { WriteTool } from "@/server/app/writes/write-tool.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import { type DeleteSplit, DeleteTargets } from "@/server/tools/nodes-delete/delete-targets.ts";
import {
  type NodesDeleteInput,
  NodesDeleteInputSchema,
  type NodesDeleteOutput,
} from "@/server/tools/nodes-delete/nodes-delete.schema.ts";
import { deleteOp } from "@/shared/ops/delete/delete.manifest.ts";

type Deleted = zod.output<typeof deleteOp.output>;

/**
 * nodes_delete (T-045): the plugin deletes each layer on its own and leaves one it cannot with why; dryRun and version
 * like every writer (D-35), the probe a dry run of the same op. What it changed is the layers it deleted.
 */
@injectable()
export class NodesDeleteTool extends WriteTool<NodesDeleteInput, DeleteSplit, Deleted, NodesDeleteOutput> {
  protected readonly input = NodesDeleteInputSchema;
  protected readonly op = deleteOp;

  protected async prepare({ nodes }: NodesDeleteInput): Promise<DeleteSplit> {
    return new DeleteTargets().split(nodes);
  }

  protected async write({ nodes, dropped }: DeleteSplit, dryRun: boolean): Promise<Deleted> {
    const result = await this.session.run(deleteOp, { nodes, dryRun });

    return { ...result, errors: [...dropped, ...result.errors] };
  }

  protected changes({ deleted }: Deleted): number {
    return deleted.length;
  }

  protected output(result: Deleted, fields: WriterOutput): NodesDeleteOutput {
    return { ...result, ...fields };
  }
}
