import { LINT_RULE_IDS, LINT_SEVERITIES } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";
import { WithinSchema } from "../../plugin/scope.ts";

export const DesignLintInputSchema = z.object({
  within: WithinSchema.exactOptional().describe(
    'What to lint: a layer id, a page id (its top layers), or "file". Default: the layers selected in Figma, else the current page.',
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
