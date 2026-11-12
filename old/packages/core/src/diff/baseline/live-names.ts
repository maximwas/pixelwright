import type { Snapshot, SnapshotStyle, SnapshotVariable } from "../../types/snapshot.ts";

/**
 * The baseline's snapshot with the live read's names (and code syntax) for the variables and styles both use, matched
 * by id: a renamed token is then one token change, not a var() change on every layer that uses it.
 */
export function withLiveNames(before: Snapshot, after: Snapshot): Snapshot {
  return {
    ...before,
    variables: Object.fromEntries(
      Object.entries(before.variables).map(([id, variable]) => [id, liveVariable(variable, after.variables[id])]),
    ),
    styles: Object.fromEntries(
      Object.entries(before.styles).map(([id, style]) => [id, liveStyle(style, after.styles[id])]),
    ),
  };
}

function liveVariable(variable: SnapshotVariable, live: SnapshotVariable | undefined): SnapshotVariable {
  if (live === undefined) {
    return variable;
  }

  const { codeSyntax: _, ...rest } = variable;

  return {
    ...rest,
    name: live.name,
    ...(live.codeSyntax === undefined ? {} : { codeSyntax: live.codeSyntax }),
  };
}

/** A style with the live name and number (the second Black is --Black-2). */
function liveStyle(style: SnapshotStyle, live: SnapshotStyle | undefined): SnapshotStyle {
  if (live === undefined) {
    return style;
  }

  const { duplicate: _, ...rest } = style;

  return {
    ...rest,
    name: live.name,
    ...(live.duplicate === undefined ? {} : { duplicate: live.duplicate }),
  };
}
