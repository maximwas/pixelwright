// Clean: a callback passed as an argument keeps its two parameters on one line; only signatures wrap.
export class Labels {
  numbered(names: readonly string[]): number[] {
    return names.map((name, index) => name.length + index);
  }
}
