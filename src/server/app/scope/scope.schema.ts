import * as zod from "zod/mini";
import { WITHIN } from "@/server/app/scope/scope.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

/** Where a tool works (S-043): a layer or a page by id, a list of them, or "file" for every page. */
export const WithinSchema = zod.union([
  zod.literal(WITHIN.file),
  NodeIdSchema,
  zod.array(NodeIdSchema).check(zod.minLength(1)),
]);
