import type * as z from "zod";
import type {
  InspectBoxSchema,
  InspectedLayerSchema,
  InspectRawSchema,
  InspectViewSchema,
} from "../schemas/inspect.ts";

export type InspectBox = z.output<typeof InspectBoxSchema>;
export type InspectedLayer = z.output<typeof InspectedLayerSchema>;
export type InspectRaw = z.output<typeof InspectRawSchema>;
export type InspectView = z.output<typeof InspectViewSchema>;
export type InspectedLayerView = InspectView["layers"][number];
