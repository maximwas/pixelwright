import type * as z from "zod";
import type { DesignDiffSchema, DiffChangeSchema, DiffOnlySchema } from "../schemas/diff.ts";

export type DesignDiff = z.output<typeof DesignDiffSchema>;
export type DiffChange = z.output<typeof DiffChangeSchema>;
export type DiffOnly = z.output<typeof DiffOnlySchema>;
