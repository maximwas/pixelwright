// Clean: a callback passed as an argument keeps its two parameters on one line; only signatures wrap.
export class Labels {
  numbered(names: readonly string[]): string[] {
    return names.map((name, index) => `${index}: ${name}`);
  }
}
