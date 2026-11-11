import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DryRunInputSchema, VersionInputSchema, WRITER_OUTPUT } from "@/server/app/writes/writes.schema.ts";
import { NODES_DELETE_FIELD } from "@/server/tools/nodes-delete/nodes-delete.constants.ts";
import { DELETE } from "@/shared/ops/delete/delete.constants.ts";
import { deleteOp } from "@/shared/ops/delete/delete.manifest.ts";

export const NodesDeleteInputSchema = zod.strictObject({
  nodes: zod
    .array(zod.string().check(zod.minLength(1), zod.maxLength(DELETE.idChars)))
    .check(zod.minLength(1), zod.maxLength(DELETE.maxNodes), zod.describe(NODES_DELETE_FIELD.nodes)),
  dryRun: DryRunInputSchema,
  version: VersionInputSchema,
  file: FileInputSchema,
});

export const NodesDeleteOutputSchema = zod.object({
  deleted: deleteOp.output.shape.deleted.check(zod.describe(NODES_DELETE_FIELD.deleted)),
  errors: deleteOp.output.shape.errors.check(zod.describe(NODES_DELETE_FIELD.errors)),
  ...WRITER_OUTPUT,
});

export type NodesDeleteInput = zod.output<typeof NodesDeleteInputSchema>;

export type NodesDeleteOutput = zod.output<typeof NodesDeleteOutputSchema>;
