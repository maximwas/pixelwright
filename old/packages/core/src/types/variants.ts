import type * as z from "zod";
import type { VariantsViewSchema } from "../schemas/variants.ts";

export type VariantsView = z.output<typeof VariantsViewSchema>;
