import { DTCG_ROOT } from "./constants.ts";

/** Something placed in a DTCG tree: its id, its name, and the path its name gives. */
export interface PathEntry {
  readonly id: string;
  readonly name: string;
  readonly path: readonly string[];
}

/** A name's path: its "/" segments, each without what DTCG reserves (".", "{", "}" and a leading "$"). */
export function pathOf(name: string): string[] {
  return name
    .split("/")
    .map((segment) => segment.trim().replace(/[.{}]/g, "-").replace(/^\$+/, ""))
    .filter((segment) => segment !== "");
}

/** A collection's or mode's key among the trees: lower case, letters and digits of any script, the rest as "-". */
export function treeKeyOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Where each entry goes: its path, suffixed when an earlier one took it (said in `renamed`), or its path's `$root`
 * when another path continues under it.
 */
export function placements(entries: readonly PathEntry[], renamed: string[]): Map<string, string[]> {
  const taken = new Set<string>();
  const unique = entries.map(({ id, name, path }) => {
    const placed = freePath(path, taken);

    if (placed !== path) {
      renamed.push(`${name} has the same DTCG path as another token: written as ${placed.join(".")}.`);
    }

    taken.add(placed.join("/"));

    return [id, placed] as const;
  });
  const groups = new Set(
    unique.flatMap(([, path]) => path.slice(1).map((_, length) => path.slice(0, length + 1).join("/"))),
  );

  return new Map(unique.map(([id, path]) => [id, groups.has(path.join("/")) ? [...path, DTCG_ROOT] : [...path]]));
}

/** The path, or the first with its last segment suffixed -2, -3… that is not taken. */
function freePath(path: readonly string[], taken: ReadonlySet<string>): readonly string[] {
  let placed = path;

  for (let index = 2; taken.has(placed.join("/")); index++) {
    placed = [...path.slice(0, -1), `${path.at(-1) ?? ""}-${index}`];
  }

  return placed;
}
