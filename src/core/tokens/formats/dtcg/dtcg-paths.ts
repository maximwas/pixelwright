import { InjectionToken, injectable } from "@needle-di/core";
import { TOKEN_TEXT } from "@/core/kernel/names/names.constants.ts";
import { DTCG_KEY, DTCG_NOTE, DTCG_NUMBER, DTCG_PATTERN } from "@/core/tokens/formats/dtcg/dtcg.constants.ts";
import type { DtcgGroup, DtcgToken, PathEntry } from "@/core/tokens/formats/dtcg/dtcg.types.ts";

/**
 * Paths and keys in DTCG trees (K-014): a name's "/" segments without what DTCG reserves, a tree's key from a
 * collection's or mode's name, a path or key an earlier one took numbered -2, -3…, and a token whose path is also a
 * group put at the group's `$root` (DTCG 2025.10).
 */
@injectable()
export class DtcgPaths {
  /** A name's path: its "/" segments trimmed, ".", "{" and "}" as "-", a leading "$" dropped, empty ones left out. */
  path(name: string): string[] {
    return name
      .split(DTCG_KEY.slash)
      .map((segment) =>
        segment.trim().replace(DTCG_PATTERN.reserved, DTCG_KEY.dash).replace(DTCG_PATTERN.leadingDollar, DTCG_KEY.none),
      )
      .filter((segment) => segment !== DTCG_KEY.none);
  }

  /** A collection's or mode's key among the trees: lower case, letters and digits of any script, the rest as "-". */
  key(name: string): string {
    return name
      .toLowerCase()
      .replace(DTCG_PATTERN.other, DTCG_KEY.dash)
      .replace(DTCG_PATTERN.edgeDashes, DTCG_KEY.none);
  }

  /** The wanted key, or the first of -2, -3… not taken; the key returned is taken from then on. */
  unique(wanted: string, taken: Set<string>): string {
    let candidate = wanted;

    for (let index = DTCG_NUMBER.firstCopy; taken.has(candidate); index++) {
      candidate = TOKEN_TEXT.numbered(wanted, index);
    }

    taken.add(candidate);

    return candidate;
  }

  /**
   * Where each entry goes: its path, its last segment numbered when an earlier entry took it (said in `renamed`), and
   * the path's `$root` when another path continues under it.
   */
  places(entries: readonly PathEntry[], renamed: string[]): Map<string, string[]> {
    const taken = new Set<string>();
    const placed = entries.map(({ id, name, path }) => {
      const free = this.#free(path, taken);

      if (free !== path) {
        renamed.push(DTCG_NOTE.samePath(name, free));
      }

      taken.add(free.join(DTCG_KEY.slash));

      return [id, free] as const;
    });
    const groups = new Set<string>();

    for (const [, path] of placed) {
      for (let length = 1; length < path.length; length++) {
        groups.add(path.slice(0, length).join(DTCG_KEY.slash));
      }
    }

    return new Map(
      placed.map(([id, path]) => [id, groups.has(path.join(DTCG_KEY.slash)) ? [...path, DTCG_KEY.root] : [...path]]),
    );
  }

  /** Puts a token at its path, making the groups on the way; a token in the way of a group gives way to it. */
  put(
    tree: DtcgGroup,
    path: readonly string[],
    token: DtcgToken,
  ): void {
    let group = tree;

    for (const segment of path.slice(0, -1)) {
      const next = group[segment];

      if (next === undefined || DTCG_KEY.type in next) {
        group[segment] = {};
      }

      group = group[segment] as DtcgGroup;
    }

    const last = path.at(-1);

    if (last !== undefined) {
      group[last] = token;
    }
  }

  /** The path, or the first with its last segment numbered -2, -3… that is not taken. */
  #free(path: readonly string[], taken: ReadonlySet<string>): readonly string[] {
    let placed = path;

    for (let index = DTCG_NUMBER.firstCopy; taken.has(placed.join(DTCG_KEY.slash)); index++) {
      placed = [...path.slice(0, -1), TOKEN_TEXT.numbered(path.at(-1) ?? DTCG_KEY.none, index)];
    }

    return placed;
  }
}

export const DTCG_PATHS = new InjectionToken<DtcgPaths>("DtcgPaths");
