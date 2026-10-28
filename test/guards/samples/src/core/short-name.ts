// Planted: a one-letter name for a value. Refused by id-length (x and y stay allowed as coordinates).
export class Totals {
  sum(values: readonly number[], origin: { x: number; y: number }): number {
    return values.reduce((s, value) => s + value, origin.x + origin.y);
  }
}
