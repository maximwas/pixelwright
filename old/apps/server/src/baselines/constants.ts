import { join } from "node:path";

/** Where baselines live in a project. */
export const BASELINES_DIR = join(".pixelwright", "baselines");

/** A baseline's name: lowercase words joined by hyphens, as code names files (pricing, plan-card). */
export const BASELINE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The most baselines one overview lists. */
export const MAX_BASELINES = 50;

/** How long an overview checks baselines before it leaves the rest unchecked. */
export const OVERVIEW_MS = 60_000;

/** How many compared states the server keeps for accept. */
export const SEEN_DESIGNS = 8;

/** How long the same version title is refused again in one file. */
export const VERSION_REPEAT_MS = 600_000;

/** What a version saved before a write says in Figma's history. */
export const VERSION_BEFORE_DESCRIPTION = "Saved by Pixelwright before it changed the file.";
