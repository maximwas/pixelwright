/** What numbering needs to know of a style. */
export interface NumberedStyle {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly remote: boolean;
}

/**
 * The number of each style that shares its kind and name with another: the file's own first, by id, then library
 * ones, by id; 1 keeps the plain token name, 2 and on get --Name-2. Styles whose name is their own are left out.
 * Every reader numbers the same set the same way, so tokens_read, design_read and design_apply mean one style.
 */
export function styleNumbers(styles: readonly NumberedStyle[]): Map<string, number> {
  const groups = new Map<string, NumberedStyle[]>();

  for (const style of styles) {
    const key = `${style.type} ${style.name}`;
    const group = groups.get(key) ?? [];

    if (!group.some((other) => other.id === style.id)) {
      group.push(style);
    }

    groups.set(key, group);
  }

  const numbers = new Map<string, number>();

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const ordered = group.toSorted(
      (a, b) => Number(a.remote) - Number(b.remote) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

    for (const [index, style] of ordered.entries()) {
      numbers.set(style.id, index + 1);
    }
  }

  return numbers;
}
