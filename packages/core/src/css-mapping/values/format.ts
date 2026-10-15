/** A length in whole pixels, `0` without a unit. */
export function px(value: number): string {
  const rounded = Math.round(value);

  return rounded === 0 ? "0" : `${rounded}px`;
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

/** A file's url(): bare where CSS reads it so, quoted when the path holds spaces, quotes, brackets or backslashes. */
export function cssUrl(path: string): string {
  return /^[^\s"'()\\]+$/.test(path) ? `url(${path})` : `url("${path.replace(/["\\]/g, "\\$&")}")`;
}
