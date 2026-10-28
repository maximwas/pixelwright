// Planted: a free function wrapped in a class of static members. Refused by @typescript-eslint/no-extraneous-class.
export class Halves {
  static of(value: number): number {
    return value / 2;
  }
}
