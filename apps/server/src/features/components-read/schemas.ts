import { OPERATION_SCHEMAS } from "@pixelwright/core";
import * as z from "zod";
import { FileSchema } from "../../plugin/file-schema.ts";

const { shape } = OPERATION_SCHEMAS.components.input;

export const ComponentsReadInputSchema = z.object({
  scope: shape.scope.describe("used: what the page (or within) uses; local: what the file defines."),
  within: shape.within.describe(
    "A layer or page id to look in. Default: the current page (used) or every page (local).",
  ),
  query: shape.query.describe("Only components whose name contains this."),
  limit: shape.limit,
  file: FileSchema,
});

export const ComponentsReadOutputSchema = OPERATION_SCHEMAS.components.output;
