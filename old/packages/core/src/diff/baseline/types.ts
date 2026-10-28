/** A value before and after: null where a side has none. */
export type Pair = [string | null, string | null];

/** How many entries each list of a baseline's changes holds. */
export interface Counts {
  readonly changed: number;
  readonly added: number;
  readonly removed: number;
  readonly moved: number;
  readonly reordered: number;
  readonly components: number;
  readonly tokens: number;
}

/** What changed between a baseline and the design now, in design_read's terms. */
export interface BaselineChanges {
  readonly changed: {
    path: string;
    id: string;
    was?: string;
    tag: string;
    attributes: Record<string, Pair>;
    drawing?: true;
  }[];
  readonly added: { path: string; id: string; tag: string; was?: "hidden"; xml?: string }[];
  readonly removed: { path: string; id: string; tag: string; now?: "hidden" }[];
  readonly moved: { path: string; id: string; from: string }[];
  readonly reordered: { path: string; id: string; before: string[]; after: string[] }[];
  readonly components: {
    component: string;
    path: string;
    change: "changed" | "added" | "removed";
    attributes?: Record<string, Pair>;
    drawing?: true;
    xml?: string;
    instances: string[];
    of: number;
  }[];
  readonly tokens: {
    token: string;
    name: string;
    was?: string;
    mode?: string;
    before: string | null;
    after: string | null;
    layers: number;
  }[];
  readonly notCompared: { path: string; id: string; what: "children" | "drawing" }[];
}
