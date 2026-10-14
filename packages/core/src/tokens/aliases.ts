/** The id of the variable a value points at, when the value is a variable alias. */
export function aliasOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { type, id } = value as { type?: unknown; id?: unknown };

  return type === "VARIABLE_ALIAS" && typeof id === "string" ? id : null;
}
