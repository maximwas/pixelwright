import type { DesignTree } from "../../design/tree.ts";
import { colorSpaceOf } from "../../kernel/color/color-space.ts";
import { styleTokenName } from "../../kernel/names.ts";
import { styleTokens } from "../../tokens/model/style-tokens.ts";
import { Notes } from "../../tokens/notes.ts";
import type { RawTokens } from "../../tokens/raw-tokens.ts";
import type { Snapshot, SnapshotStyle } from "../../types/snapshot.ts";
import { TokenUses } from "./token-uses.ts";
import type { BaselineChanges } from "./types.ts";
import { SideVariables, variableChanges } from "./variable-changes.ts";

type TokenEntry = BaselineChanges["tokens"][number];

/** One side's tokens: its raw tokens (null when they could not be read), its snapshot and its design tree. */
export interface TokenSide {
  readonly raw: RawTokens | null;
  readonly snapshot: Snapshot;
  readonly tree: DesignTree;
}

/**
 * Every variable and style either side's layers use, matched by id: values changed (variables mode by mode), renamed,
 * newly used, no longer used, with how many elements use each. Without raw tokens on a side, the reads' token maps stand
 * in, one mode, and a note says so.
 */
export function tokenChanges(before: TokenSide, after: TokenSide, notes: string[]): TokenEntry[] {
  const uses = {
    before: new TokenUses(before.tree.root),
    after: new TokenUses(after.tree.root),
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
  const variables = unique([
    ...Object.keys(after.snapshot.variables),
    ...Object.keys(before.snapshot.variables),
  ]).flatMap((id) =>
    variableChanges(
      {
        id,
        before: before.snapshot.variables[id] !== undefined,
        after: after.snapshot.variables[id] !== undefined,
      },
      sides,
      uses,
    ),
  );

  return [...variables, ...styleChanges(before.snapshot, after.snapshot, uses)];
}

/** The styles either side uses, compared as their token values (a text style as its font shorthand), by id. */
function styleChanges(before: Snapshot, after: Snapshot, uses: { before: TokenUses; after: TokenUses }): TokenEntry[] {
  return unique([...Object.keys(after.styles), ...Object.keys(before.styles)]).flatMap((id) => {
    const old = before.styles[id];
    const now = after.styles[id];
    const shown = now ?? old;

    if (shown === undefined) {
      return [];
    }

    const pair = [styleValue(id, old, before), styleValue(id, now, after)] as const;
    const was = old !== undefined && now !== undefined && old.name !== now.name ? old.name : undefined;

    if (pair[0] === pair[1] && was === undefined) {
      return [];
    }

    const token = styleTokenName(shown);
    const counted = now === undefined ? uses.before : uses.after;

    return [
      {
        token,
        name: shown.name,
        ...(was === undefined ? {} : { was }),
        before: pair[0],
        after: pair[1],
        layers: counted.count(token, shown.type === "TEXT" ? shown.name : undefined),
      },
    ];
  });
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

/** The reads' own token and text style maps compared by name: no modes, no renames. */
function fromTrees(before: DesignTree, after: DesignTree, uses: { before: TokenUses; after: TokenUses }): TokenEntry[] {
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

  return [...compared(before.tokens, after.tokens, false), ...compared(before.textStyles, after.textStyles, true)];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
