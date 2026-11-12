import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { saveNamedVersion } from "./save-named-version.ts";
import { VersionSaveInputSchema, VersionSaveOutputSchema } from "./schemas.ts";
import { VersionTries } from "./version-tries.ts";

export function versionSaveTool(
  context: ToolContext,
): ToolDefinition<typeof VersionSaveInputSchema, typeof VersionSaveOutputSchema> {
  // One server's tries: the same title is refused in a file for ten minutes after it was tried.
  const tries = new VersionTries();

  return {
    name: "version_save",
    title: "Save a named version",
    description:
      "Saves a named version in the file's Figma version history, for people: the designer can open the design as it was, and developers on a paid plan can pick it in Dev Mode's Compare changes. Save one only when the user asks: Figma's plugin API cannot list, read or delete a version, so it stays in the history. baselines: the baselines it goes with; it is saved only while the design still matches them, and they record it. Needs edit access to the file and the plugin's Allow edits; the same title is refused twice within ten minutes.",
    input: VersionSaveInputSchema,
    output: VersionSaveOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) =>
      saveNamedVersion(
        {
          ...context,
          tries,
        },
        args,
      ),
    changed: () => true,
  };
}
