/** A CSS value without the `var(--name, …)` Figma may wrap around it: the fallback inside, else the value as given. */
export function unwrapVar(value: string | undefined): string | undefined {
  const match = /^var\(\s*--[^,()]+,\s*([\s\S]+)\)$/.exec(value?.trim() ?? "");

  return match?.[1]?.trim() ?? value;
}
