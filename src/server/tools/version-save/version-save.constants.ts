import type { BaselineCounts } from "@/core/diff/baseline/baseline.schema.ts";

/** version_save as clients list it (T-180). */
export const VERSION_SAVE_TOOL = {
  name: "version_save",
  title: "Save a named version",
  description:
    "Saves a named version in the file's Figma version history, for people: the designer can open the design as it was, and developers on a paid plan can pick it in Dev Mode's Compare changes. Save one only when the user asks: Figma's plugin API cannot list, read or delete a version, so it stays in the history. baselines: the baselines it goes with; it is saved only while the design still matches them, and they record it. Needs edit access to the file and the plugin's Allow edits; the same title is refused twice within ten minutes.",
} as const;

export const VERSION_SAVE_FIELD = {
  title: 'The version\'s name in Version history, e.g. "Built: pricing".',
  description: "Shown under the title. Everyone with the file sees it: no local paths or private repository names.",
  baselines:
    "The baselines this version goes with: it is saved only while the design still matches each one, and they record it.",
  file: "A session from status, or a file name. Default: the file of the first baseline, else the active file.",
  id: "The version's id; null when Figma gave none.",
  recorded: "The baselines that recorded the version.",
} as const;

/** How many baselines a description names before it counts the rest, and how many one version goes with. */
export const VERSION_SAVE = { namedBaselines: 3, maxBaselines: 10, lineBreak: "\n" } as const;

export const VERSION_SAVE_TEXT = {
  baselineLine: (
    name: string,
    node: string,
    id: string,
  ) =>
    `Pixelwright baseline "${name}": the code was built from "${node}" (${id}) as it is in this version.`,
  more: (count: number) => `and ${count} more`,
  savedBy: "Saved by Pixelwright.",
  otherFile: (
    name: string,
    came: string,
    file: string,
  ) =>
    `${name} comes from ${came}, not ${file}: save its version there.`,
  editsOff: (file: string, title: string) =>
    `Allow edits is off in ${file}: turn it on in the Pixelwright window to save the version "${title}".`,
  uncompared: (name: string, reason: string) => `${name}: ${reason}`,
  changed: (name: string, { changed, added, removed, moved, reordered, components, tokens }: BaselineCounts) => {
    const layers = changed + added + removed + moved + reordered + components;

    return `${name} changed since it was saved (${layers} ${layers === 1 ? "layer" : "layers"}, ${tokens} ${tokens === 1 ? "token" : "tokens"}): diff it, update the code and accept before saving a version.`;
  },
  notSaved: (why: string) => `Figma did not save the version: ${why}. A version needs Can edit access to the file.`,
  savedAgain: (name: string) => `${name} was saved again meanwhile: the version is saved but not recorded in it.`,
  noId: "Figma saved the version without giving its id.",
} as const;
