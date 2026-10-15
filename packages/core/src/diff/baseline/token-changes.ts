import type { DesignTree } from "../../design/tree.ts";
import { colorSpaceOf } from "../../kernel/color/color-space.ts";
import { styleTokenName } from "../../kernel/names.ts";
import { styleTokens } from "../../tokens/model/style-tokens.ts";
import { Notes } from "../../tokens/notes.ts";
import type { RawTokens } from "../../tokens/raw-tokens.ts";
import type { Snapshot, SnapshotStyle } from "../../types/snapshot.ts";
import { aliasedVariables, boundVariables, usedStyles } from "./bound-variables.ts";
import { TokenUses } from "./token-uses.ts";
import type { BaselineChanges } from "./types.ts";
import { SideVariables, variableChanges } from "./variable-changes.ts";

type TokenEntry = BaselineChanges["tokens"][number];

/**
 * One side's tokens: its raw tokens (null when they could not be read), its snapshot and its design tree, and the
 * layers not compared (under a parent whose children were cut on either side), whose tokens are left out too.
 */
export interface TokenSide {
  readonly raw: RawTokens | null;
  readonly snapshot: Snapshot;
  readonly tree: DesignTree;
  readonly skip: ReadonlySet<string>;
}

/**
 * Every variable and style either side's layers use, matched by id: values changed (variables mode by mode), renamed,
 * newly used, no longer used, with how many elements use each. Without raw tokens on a side, the reads' token maps stand
 * in, one mode, and a note says so.
 */
export function tokenChanges(before: TokenSide, after: TokenSide, notes: string[]): TokenEntry[] {
  const uses = {
    before: new TokenUses(before.tree.root, before.skip),
    after: new TokenUses(after.tree.root, after.skip),
  };

  if (before.raw === null || after.raw === null) {
    notes.push(
      `Tokens were compared as the reads wrote them, one mode each: ${before.raw === null ? "the baseline" : "the design now"} has no token values.`,
    );

    return fromTrees(before.tree, after.tree, uses);
  }

  const sides = {
    before: new SideVariables(before.raw),
    after: new SideVariables(after.raw),
  };
  const used = {
    before: usedVariables(before, before.raw),
    after: usedVariables(after, after.raw),
  };
  const variables = unique([...used.after.keys(), ...used.before.keys()]).flatMap((id) =>
    variableChanges(
      {
        id,
        before: used.before.get(id),
        after: used.after.get(id),
      },
      sides,
      uses,
    ),
  );

  return [...variables, ...styleChanges(before, after, uses)];
}

/**
 * The variables a side's layers use, each with the bound ones it is reached through (none for a bound one): bound
 * variables and the ones they alias. The ones Figma merely matches a raw value to are hints, not what the layers use.
 */
function usedVariables(side: TokenSide, raw: RawTokens): Map<string, readonly string[]> {
  const bound = boundVariables(side.snapshot.root, side.skip);

  return new Map<string, readonly string[]>([
    ...[...bound].map((id) => [id, []] as const),
    ...[...aliasedVariables(bound, raw)].map(([id, through]) => [id, [...through]] as const),
  ]);
}

/** The styles either side's compared layers use, as their token values (a text style as its font shorthand), by id. */
function styleChanges(
  before: TokenSide,
  after: TokenSide,
  uses: { before: TokenUses; after: TokenUses },
): TokenEntry[] {
  const used = {
    before: usedStyles(before.snapshot.root, before.skip),
    after: usedStyles(after.snapshot.root, after.skip),
  };

  return unique([...used.after, ...used.before]).flatMap((id) => {
    const change = styleChange(id, {
      old: used.before.has(id) ? before.snapshot.styles[id] : undefined,
      now: used.after.has(id) ? after.snapshot.styles[id] : undefined,
      snapshots: [before.snapshot, after.snapshot],
      uses,
    });

    return change === null ? [] : [change];
  });
}

/** One style's change: its value, a rename, newly used or no longer used; null when it is the same. */
function styleChange(
  id: string,
  {
    old,
    now,
    snapshots,
    uses,
  }: {
    old: SnapshotStyle | undefined;
    now: SnapshotStyle | undefined;
    snapshots: readonly [Snapshot, Snapshot];
    uses: { before: TokenUses; after: TokenUses };
  },
): TokenEntry | null {
  const shown = now ?? old;

  if (shown === undefined) {
    return null;
  }

  const pair = [styleValue(id, old, snapshots[0]), styleValue(id, now, snapshots[1])] as const;
  const was = old !== undefined && now !== undefined && old.name !== now.name ? old.name : undefined;

  if (pair[0] === pair[1] && was === undefined) {
    return null;
  }

  const token = styleTokenName(shown);
  const counted = now === undefined ? uses.before : uses.after;

  return {
    token,
    name: shown.name,
    ...(was === undefined ? {} : { was }),
    before: pair[0],
    after: pair[1],
    layers: counted.count(token, shown.type === "TEXT" ? shown.name : undefined),
  };
}

/** A style's token value as tokens_read writes it; null when the side does not use it. */
function styleValue(id: string, style: SnapshotStyle | undefined, snapshot: Snapshot): string | null {
  if (style === undefined) {
    return null;
  }

  const written = styleTokens(
    [
      {
        id,
        ...style,
      },
    ],
    {
      space: colorSpaceOf(snapshot.colorProfile),
      notes: new Notes(),
    },
  );
  const [token] = [...written.paint, ...written.text, ...written.effect];

  return token?.value ?? null;
}

/**
 * The reads' own token and text style maps compared by name: no modes, no renames; a name only the layers left out
 * of the comparison use is no use.
 */
function fromTrees(before: DesignTree, after: DesignTree, uses: { before: TokenUses; after: TokenUses }): TokenEntry[] {
  const kept = (map: Record<string, string>, side: TokenUses, textStyles: boolean) =>
    Object.fromEntries(
      Object.entries(map).filter(([name]) => (textStyles ? side.count("", name) : side.count(name)) > 0),
    );
  const compared = (left: Record<string, string>, right: Record<string, string>, textStyles: boolean) =>
    unique([...Object.keys(right), ...Object.keys(left)]).flatMap((name) => {
      const pair = [left[name] ?? null, right[name] ?? null] as const;
      const counted = right[name] === undefined ? uses.before : uses.after;

      return pair[0] === pair[1]
        ? []
        : [
            {
              token: name,
              name,
              before: pair[0],
              after: pair[1],
              layers: textStyles ? counted.count("", name) : counted.count(name),
            },
          ];
    });

  return [
    ...compared(kept(before.tokens, uses.before, false), kept(after.tokens, uses.after, false), false),
    ...compared(kept(before.textStyles, uses.before, true), kept(after.textStyles, uses.after, true), true),
  ];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
