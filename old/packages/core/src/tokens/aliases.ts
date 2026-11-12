import type { RawVariable } from "./raw-tokens.ts";

/** The id of the variable a value points at, when the value is a variable alias. */
export function aliasOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { type, id } = value as { type?: unknown; id?: unknown };

  return type === "VARIABLE_ALIAS" && typeof id === "string" ? id : null;
}

/** The aliases between these variables, each as [the variable, the one it points at], both among them. */
export function aliasLinks(variables: readonly RawVariable[]): (readonly [string, string])[] {
  const ids = new Set(variables.map(({ id }) => id));

  return variables.flatMap((variable) =>
    Object.values(variable.valuesByMode).flatMap((value) => {
      const target = aliasOf(value);

      return target !== null && ids.has(target) ? [[variable.id, target] as const] : [];
    }),
  );
}
