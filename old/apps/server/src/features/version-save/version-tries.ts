import { VERSION_REPEAT_MS } from "../../baselines/constants.ts";

/**
 * The version titles tried lately, by file: the same title in the same file within ten minutes is refused, as a
 * version cannot be deleted. A try is noted before Figma is asked; a clear refusal forgets it, a timeout keeps it.
 */
export class VersionTries {
  readonly #tried = new Map<string, number>();

  /** When the same title was last tried in this file, if within the repeat window. */
  recent(file: string, title: string): number | undefined {
    const at = this.#tried.get(keyOf(file, title));

    return at !== undefined && Date.now() - at < VERSION_REPEAT_MS ? at : undefined;
  }

  note(file: string, title: string): void {
    this.#tried.set(keyOf(file, title), Date.now());
  }

  forget(file: string, title: string): void {
    this.#tried.delete(keyOf(file, title));
  }
}

function keyOf(file: string, title: string): string {
  return `${file}\n${title.trim().toLowerCase()}`;
}
