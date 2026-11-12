// Planted: a satellite that imports its own folder with ./ instead of the @/ alias. Refused by no-relative-import-paths
// (allowSameFolder: false).
import type { SlugMaker } from "./slug.ts";

export type Slugs = SlugMaker[];
