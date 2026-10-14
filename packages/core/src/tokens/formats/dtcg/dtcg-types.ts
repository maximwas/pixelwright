import { aliasOf } from "../../aliases.ts";
import type { RawTokens, RawVariable } from "../../raw-tokens.ts";
import { DTCG_DIMENSION_SCOPES } from "./constants.ts";

/**
 * Each variable's DTCG type: from its own type and scopes, then from the tokens it is linked with by an alias, so a
 * reference never points at a token left out or of another unit (a FLOAT for any field aliased by a gap is a dimension;
 * a text aliased by a font family is a font family).
 */
export function dtcgTypes(raw: RawTokens): Map<string, string | null> {
  const types = new Map(raw.variables.map((variable) => [variable.id, dtcgTypeOf(variable)]));
  const links = raw.variables.flatMap((variable) =>
    Object.values(variable.valuesByMode).flatMap((value) => {
      const target = aliasOf(value);

      return target !== null && types.has(target) ? [[variable.id, target] as const] : [];
    }),
  );
  let changed = true;

  while (changed) {
    changed = false;

    for (const [a, b] of links) {
      // Either end of a link may be the one that knows better; both are tried until nothing changes.
      changed = strengthened(types, a, b) || changed;
      changed = strengthened(types, b, a) || changed;
    }
  }

  return types;
}

/** The DTCG type a variable's values take, from its type and scopes; null when DTCG has none. */
function dtcgTypeOf(variable: RawVariable): string | null {
  const scoped = (allowed: (scope: string) => boolean) =>
    variable.scopes.length > 0 && variable.scopes.every((scope) => allowed(scope));

  switch (variable.resolvedType) {
    case "COLOR":
      return "color";
    case "FLOAT":
      if (scoped((scope) => DTCG_DIMENSION_SCOPES.has(scope))) {
        return "dimension";
      }

      return scoped((scope) => scope === "FONT_WEIGHT") ? "fontWeight" : "number";
    case "STRING":
      return scoped((scope) => scope === "FONT_FAMILY") ? "fontFamily" : null;
    default:
      return null;
  }
}

/** Gives `weak` the type of `strong` when it has none, or only "number" where `strong` says more. */
function strengthened(types: Map<string, string | null>, weak: string, strong: string): boolean {
  const own = types.get(weak) ?? null;
  const other = types.get(strong) ?? null;

  if (other === null || other === own || (own !== null && !(own === "number" && other !== "number"))) {
    return false;
  }

  types.set(weak, other);

  return true;
}
