// Planted: mutable state at module level. Refused by no-restricted-syntax.
let count = 0;

export function nextCount(): number {
  count += 1;

  return count;
}
