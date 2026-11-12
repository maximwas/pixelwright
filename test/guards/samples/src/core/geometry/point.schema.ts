// Planted: core takes classic zod (454 KB in the plugin bundle). Refused by no-restricted-imports (zod/mini only).
import { z } from "zod";

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
