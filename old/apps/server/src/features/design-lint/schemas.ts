import { LINT_RULE_IDS, LINT_SEVERITIES } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinIdsSchema, WithinSchema } from "../../plugin/scope.ts";
import { LINT_MAX_ROOTS } from "./constants.ts";

export const DesignLintInputSchema = z.object({
  within: z
    .union([...WithinSchema.options, WithinIdsSchema.max(LINT_MAX_ROOTS)])
    .exactOptional()
    .describe(
      `What to lint: a layer id, a list of up to ${LINT_MAX_ROOTS} layer ids (each read on its own: a big board's frames), a page id (its top layers), or "file". Default: the layers selected in Figma, else the current page.`,
    ),
  rules: z.array(z.enum(LINT_RULE_IDS)).min(1).exactOptional().describe("Only these rules. Default: every rule."),
  severity: z
    .enum(LINT_SEVERITIES)
    .default("info")
    .describe("The least severe findings to list: error, warning, or info (everything)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe("The most findings listed; every rule is still counted."),
  file: FileSchema,
});
