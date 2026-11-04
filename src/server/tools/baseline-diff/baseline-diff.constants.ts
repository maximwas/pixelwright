/** baseline_diff as clients list it (tools.json pins every word): 0.7.0's words. */
export const BASELINE_DIFF_TOOL = {
  name: "baseline_diff",
  title: "What changed since a baseline",
  description:
    "What the designer changed since baseline_save, in design_read's terms: each layer changed (its attributes as [before, after], a text's content as XML), added (with its XML when short), removed or hidden, moved to another parent or reordered; a change made in a component once, with the instances it reached and how many were compared (of); tokens whose value changed in any mode, renamed, newly used or no longer used; icons and images drawn anew (drawing: export them again). Layers are followed by id, a replaced one by its name. It sees what changes_since and Figma's own Changed mark miss: edits made while the plugin was closed, accepted library updates, variable and style values. Without name: every baseline in the project with how much changed; call it when a session starts or the user says the design changed. It reads the file the baseline came from and works while Allow edits is off. Change only the code it names (code lists the files), then call baseline_save with the accept it gives.",
} as const;

export const BASELINE_DIFF_FIELD = {
  name: "One baseline in detail. Without it: every baseline in the project, with how much changed.",
  node: "Compare with this layer instead of the baseline's own, e.g. a v2 the designer made beside it. Needs name.",
  file: "With name: compare in this file (a session from status, or a file name). Without name: only this file's baselines. Default: the file each baseline came from.",
  now: "Compared with another layer: node, or the root found again by name.",
  reason: "Missing, hidden, unavailable: what happened, and what to do.",
  accept: "Pass it to baseline_save once your code has these changes.",
  more: "Baselines past 50, or entries past 200 in one list.",
} as const;

/** How a baseline compares now (T-205, T-206); unchecked is the overview's, for the baselines past its time. */
export const BASELINE_STATUS = {
  same: "same",
  changed: "changed",
  missing: "missing",
  hidden: "hidden",
  unavailable: "unavailable",
  unchecked: "unchecked",
} as const;

/** Looking for a baseline's layer again (T-206), as 0.7.0 did: the layer alone, 50 found by name, 3 named. */
export const BASELINE_LOOKUP = { depth: 1, limit: 50, lookAlikes: 3 } as const;

export const BASELINE_DIFF_TEXT = {
  nameNeeded: "Pass name: the baseline to compare.",
  noBaseline: (name: string, names: readonly string[]) =>
    `No baseline named ${name} in this project${names.length === 0 ? "" : ` (it has ${names.join(", ")})`}: baseline_save keeps one.`,
  keyNotConnected: (name: string, key: string) =>
    `${name} (key ${key}) is not connected: open it in Figma Desktop with the Pixelwright plugin; a copy shares the name, not the key.`,
  notConnected: (name: string) =>
    `${name} is not connected: open ${name} in Figma Desktop with the Pixelwright plugin, or pass file if it was renamed.`,
  ambiguous: (name: string, sessions: readonly string[]) =>
    `Several connected files are named ${name}: sessions ${sessions.join(", ")}. Pass file (a session from status).`,
  comparedIn: (connected: string, came: string) =>
    `Compared in ${connected}, not ${came}, which the baseline came from.`,
  otherLayer: (
    id: string,
    file: string,
    stored: { readonly type: string; readonly name: string },
    held: string,
  ) =>
    `${id} in ${file} is a ${stored.type} named ${stored.name}, not the ${held} this baseline holds: is this the right file? Pass node to compare anyway.`,
  foundAgain: (
    id: string,
    name: string,
    now: string,
  ) =>
    `${id} is gone: compared with ${name} (${now}), the one layer of its name.`,
  gone: (
    layer: { readonly name: string; readonly id: string },
    lookAlikes: readonly string[],
    baseline: string,
  ) =>
    `${layer.name} (${layer.id}) is gone${lookAlikes.length === 0 ? "" : `; layers like it: ${lookAlikes.join(", ")}`}: pass node to compare one, or baseline_save {name: "${baseline}", node, replace: true} to start over.`,
  lookAlike: (name: string, id: string) => `${name} (${id})`,
  hidden: (id: string) =>
    `${id} is hidden in Figma: design_read reads no hidden layer, so nothing is compared. Show it to compare it.`,
  reader: (was: string | null, now: string | null) =>
    `Read by plugin ${was ?? "unknown"}, now ${now ?? "unknown"}: a change that comes from the newer reading goes away when you accept.`,
  notCompared: (name: string, reason: string) => `${name}: ${reason}`,
  head: (
    name: string,
    layer: string,
    id: string,
  ) => `${name}: ${layer} (${id})`,
  same: (head: string, since: string) => `${head} reads as on ${since}.`,
  since: (
    head: string,
    since: string,
    parts: readonly string[],
  ) => `${head} since ${since}: ${parts.join("; ")}.`,
  /** "1 layer changed", "3 added"; nothing for none. */
  counted: (
    count: number,
    one: string,
    many = one,
  ) => (count === 0 ? "" : `${count} ${count === 1 ? one : many}`),
  layerChanged: "layer changed",
  layersChanged: "layers changed",
  added: "added",
  removed: "removed",
  moved: "moved",
  reordered: "reordered",
  partJoiner: ", ",
} as const;
