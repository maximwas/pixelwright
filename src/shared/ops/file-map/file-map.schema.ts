import * as zod from "zod/mini";
import { DEV_STATUS } from "@/shared/ops/outline/outline.constants.ts";

/** With `layers`, the pages' layers too; without, the pages only, unloaded: what the `within` scope reads (B-036). */
export const FileMapOpInputSchema = zod.strictObject({ layers: zod.boolean() });

/** A layer in the file map (T-034): what it is, its size in px as Figma gives it (the server rounds it, D-15). */
const MapLayerSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  width: zod.number(),
  height: zod.number(),
  /** What the designer marked in Dev Mode: ready for development, or completed. */
  devStatus: zod.exactOptional(zod.enum(DEV_STATUS)),
  /** How many children the layer has; none for a layer that cannot have any. */
  childCount: zod.exactOptional(zod.int()),
});

/** A page's top layer: a section lists its own layers inside it, and how many it has when not all fit (B-036). */
const MapTopLayerSchema = zod.extend(MapLayerSchema, {
  children: zod.exactOptional(zod.array(MapLayerSchema)),
  total: zod.exactOptional(zod.int()),
});

const MapPageSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  current: zod.boolean(),
  /** How many top layers the page has, for every page read. */
  childCount: zod.exactOptional(zod.int()),
  /** How many top layers the page has, when not all are listed. */
  total: zod.exactOptional(zod.int()),
  /** None for a page not read: Figma could not load it, or the time or the layer limit ran out first. */
  nodes: zod.exactOptional(zod.array(MapTopLayerSchema)),
});

/** Pages Figma could not load (offline, say), each with its words: their layers are not read. */
export const PageNotReadSchema = zod.object({ name: zod.string(), error: zod.string() });

export const FileMapOpOutputSchema = zod.object({
  pages: zod.array(MapPageSchema),
  /** Layers left out: the time or the layer limit ran out first; outline those pages one by one. */
  more: zod.boolean(),
  pagesNotRead: zod.exactOptional(zod.array(PageNotReadSchema)),
});

export type MapLayer = zod.output<typeof MapLayerSchema>;

export type MapTopLayer = zod.output<typeof MapTopLayerSchema>;

export type MapPage = zod.output<typeof MapPageSchema>;

export type PageNotRead = zod.output<typeof PageNotReadSchema>;
