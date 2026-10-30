import * as zod from "zod/mini";
import { LINT_RULE } from "@/core/checks/lint/lint.constants.ts";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { DESIGN_LINT_FIELD, DESIGN_LINT_LIMITS } from "@/server/tools/design-lint/design-lint.constants.ts";
import { NodeIdSchema } from "@/shared/ops/show/show.schema.ts";

export const DesignLintInputSchema = zod.object({
  within: zod
    .exactOptional(zod.array(NodeIdSchema).check(zod.minLength(1), zod.maxLength(DESIGN_LINT_LIMITS.roots)))
    .check(zod.describe(DESIGN_LINT_FIELD.within)),
  rules: zod
    .exactOptional(zod.array(zod.enum(LINT_RULE)).check(zod.minLength(1)))
    .check(zod.describe(DESIGN_LINT_FIELD.rules)),
  limit: zod
    ._default(zod.int().check(zod.minimum(1), zod.maximum(DESIGN_LINT_LIMITS.maxFindings)), DESIGN_LINT_LIMITS.findings)
    .check(zod.describe(DESIGN_LINT_FIELD.limit)),
  file: FileInputSchema,
});

export type DesignLintInput = zod.output<typeof DesignLintInputSchema>;
