import type { DtcgGroup, DtcgToken } from "./types.ts";

/** Builds one DTCG tree: each token put at its path, the groups on the way made as needed. */
export class DtcgTreeBuilder {
  readonly #root: DtcgGroup = {};

  /** Puts a token at a path; a token in the way of a group is replaced by the group. */
  put(path: readonly string[], token: DtcgToken): void {
    let group = this.#root;

    for (const segment of path.slice(0, -1)) {
      const next = group[segment];

      if (next === undefined || "$type" in next) {
        group[segment] = {};
      }

      group = group[segment] as DtcgGroup;
    }

    const last = path.at(-1);

    if (last !== undefined) {
      group[last] = token;
    }
  }

  build(): DtcgGroup {
    return this.#root;
  }
}
