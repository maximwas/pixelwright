/** What a token output could not write as asked, each said once, in the order it was found. */
export class Notes {
  readonly #notes = new Set<string>();

  add(note: string): void {
    this.#notes.add(note);
  }

  list(): string[] {
    return [...this.#notes];
  }
}
