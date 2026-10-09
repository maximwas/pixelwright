/** A length in whole pixels, `0` without a unit. */
export function px(value: number): string {
  const rounded = Math.round(value);

  return rounded === 0 ? "0" : `${rounded}px`;
}

/** A number with at most two decimals. */
export function decimal(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** CSS's box shorthand (padding, radius order aside): one value when all four match, two or three when they pair. */
export function boxShorthand(top: string, right: string, bottom: string, left: string): string {
  if (top === right && right === bottom && bottom === left) {
    return top;
  }

  if (top === bottom && right === left) {
    return `${top} ${right}`;
  }

  if (right === left) {
    return `${top} ${right} ${bottom}`;
  }

  return `${top} ${right} ${bottom} ${left}`;
}
