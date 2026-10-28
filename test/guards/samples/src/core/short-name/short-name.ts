// Planted: a one-letter name for a value. Refused by id-length (x and y stay allowed as coordinates).
export class Totals {
  doubled(origin: { x: number; y: number }): number[] {
    return [origin.x, origin.y].map((v) => v * 2);
  }
}
