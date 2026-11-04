/** baseline_save as clients list it (tools.json pins every word): 0.7.0's words. */
export const BASELINE_SAVE_TOOL = {
  name: "baseline_save",
  title: "Keep a baseline",
  description:
    "Keeps a layer as you build code from it, so baseline_diff can tell later what the designer changed: its read and the values of the tokens it uses, in every mode, go into .pixelwright/baselines/<name>.json in the project (it holds the design's texts: commit the folder to share it, or leave it out of git). Save right after the design_read you build a screen or section from; name it after your code (pricing, plan-card) and list in code the files you build from it. Once your code has the changes a baseline_diff listed, pass the accept it gave: exactly the design it compared is kept, so what the designer changed after it still shows next time. An existing name is replaced only with accept or replace: true; code alone changes its file list. Writes nothing to Figma, so it works while Allow edits is off.",
} as const;

export const BASELINE_SAVE_FIELD = {
  node: "The layer the code is built from: a frame, section, component or instance. Default: the one selected layer. Not with accept.",
  name: "Named after the code: pricing, plan-card. Default: the layer's name as a slug. Required with accept.",
  code: "The project's files built from the layer, relative to the project. Default: the list the baseline already has.",
  accept: "The accept a baseline_diff answer gave: keeps exactly the design that diff compared.",
  replace: "Start the named baseline over from the layer as it is now. Not with accept.",
  path: "The baseline's file, absolute.",
  page: "Null from a plugin older than this server.",
  capturedAt: "When the design it keeps was read (the diff's read, with accept).",
  layers: "Layers read.",
  tokens: "Variables and styles kept with their values in every mode.",
  cut: "Branches the read did not hold whole: baseline_diff does not compare inside them.",
  replaced: "With replace: what the baseline it replaced kept, and how much the new read took in.",
} as const;

/** baseline_save's bounds (T-200, T-201), as 0.7.0 took them. */
export const BASELINE_SAVE = {
  /** An accept: the 16 hex digits a baseline_diff answer gave. */
  accept: /^[0-9a-f]{16}$/,
  /** At most 50 code files, each a path of 1 to 300 characters. */
  maxCode: 50,
  minPath: 1,
  maxPath: 300,
  /** A code path as a baseline keeps it: `/` between folders, relative, no step up, no drive letter. */
  backslash: "\\",
  separator: "/",
  up: "..",
  drive: /^[a-z]:/i,
} as const;

export const BASELINE_SAVE_TEXT = {
  hidden: (id: string) =>
    `${id} is hidden in Figma: design_read reads no hidden layer, so no code is built from it to keep. Show it, or keep a visible one.`,
  exists: (
    name: string,
    layer: string,
    id: string,
    saved: string,
  ) =>
    `${name} exists (${layer}, ${id}, saved ${saved}): pass the accept a baseline_diff gave, replace: true to start over, code alone to change its files, or another name.`,
  acceptAlone:
    "accept keeps the design a baseline_diff compared: give the baseline's name with it (and code, to change its files), nothing else.",
  notHeld: "That diff is no longer held (the server restarted): run baseline_diff again.",
  savedAgain: (name: string) => `${name} was saved again since that diff: run baseline_diff again.`,
  versionGone: (title: string) =>
    `The version "${title}" held the design before this one: it is no longer recorded here.`,
  outside: (given: string) => `${given}: code lists the project's files relative to it, inside it.`,
  notYet: (path: string) => `${path} is not in the project yet.`,
  madeFolder: (root: string) =>
    `Made .pixelwright/baselines in ${root}: commit it to share baselines with the team, or leave it out of git: it holds the design's texts.`,
  cut: "Save these branches as baselines of their own: baseline_diff does not compare inside them.",
} as const;
