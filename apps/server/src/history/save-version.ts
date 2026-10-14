import type { PluginSession } from "../plugin/plugin-session.ts";

/** What a saved version comes back as: its id (null when Figma gave none), and its description when the plugin kept it. */
export interface SavedVersion {
  readonly id: string | null;
  readonly description?: string;
}

/**
 * Saves a named version in the file's history, with a description when one is given. The plugin waits for Pixelwright's
 * last write to settle first; a plugin from before stage 11 saves the title only and gives no description back.
 */
export async function saveVersion(
  session: PluginSession,
  { title, description }: { title: string; description?: string },
): Promise<SavedVersion> {
  return session.run("save_version", {
    title,
    ...(description === undefined ? {} : { description }),
  });
}
