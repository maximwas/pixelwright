import { type BaselineFile, VERSION_DESCRIPTION_CHARS } from "@pixelwright/core";

/** How many baselines a description names before it says how many more. */
const NAMED_BASELINES = 3;

/**
 * A version's description: the given text, then a line per baseline it goes with, then who saved it; cut to Figma's
 * length. It never holds local paths: everyone with the file reads it.
 */
export function versionDescription(given: string | undefined, baselines: readonly BaselineFile[]): string {
  const lines = baselines
    .slice(0, NAMED_BASELINES)
    .map(
      (baseline) =>
        `Pixelwright baseline "${baseline.name}": the code was built from "${baseline.node.name}" (${baseline.node.id}) as it is in this version.`,
    );
  const more = baselines.length > NAMED_BASELINES ? [`and ${baselines.length - NAMED_BASELINES} more`] : [];
  const parts = [...(given === undefined ? [] : [given, ""]), ...lines, ...more, "Saved by Pixelwright."];

  return parts.join("\n").slice(0, VERSION_DESCRIPTION_CHARS);
}
