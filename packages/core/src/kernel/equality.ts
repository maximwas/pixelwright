/**
 * Whether two values are the same as JSON would carry them, whatever order their keys are in: primitives by `===`,
 * arrays item by item, objects key by key, keys holding undefined left out.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }

  const ownKeys = definedKeys(a);
  const otherKeys = definedKeys(b);

  return (
    ownKeys.length === otherKeys.length &&
    ownKeys.every(
      (key) =>
        Object.hasOwn(b, key) && sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

function definedKeys(value: object): string[] {
  return Object.keys(value).filter((key) => (value as Record<string, unknown>)[key] !== undefined);
}
