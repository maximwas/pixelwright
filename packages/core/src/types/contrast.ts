import type * as z from "zod";
import type { ContrastSchema, ContrastTextSchema } from "../schemas/contrast.ts";

export type Contrast = z.output<typeof ContrastSchema>;
export type ContrastText = z.output<typeof ContrastTextSchema>;
