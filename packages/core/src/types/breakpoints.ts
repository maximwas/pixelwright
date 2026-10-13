import type * as z from "zod";
import type { BreakpointsSchema, ScreensRawSchema } from "../schemas/breakpoints.ts";

export type ScreensRaw = z.output<typeof ScreensRawSchema>;
export type Breakpoints = z.output<typeof BreakpointsSchema>;
