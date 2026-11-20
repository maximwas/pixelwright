import { describe, expect, it } from "vitest";
import type * as zod from "zod/mini";
import type { JsonFile } from "@/core/ports/json-file.port.ts";
import { SupportNote } from "@/server/app/stores/support-note.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The sentence 0.7.0 gave, word for word (T-006). */
const SENTENCE =
  "Pixelwright is free. If it saves you time, you can support its development: Ko-fi (https://ko-fi.com/maksymvasianin), monobank (https://send.monobank.ua/jar/7o9oMrbXTj).";

/** The home's JSON files in memory: what support.json would hold. */
class MemoryFiles implements JsonFile {
  readonly #files = new Map<string, unknown>();

  read<Schema extends zod.ZodMiniType>(
    path: string,
    _schema: Schema,
    fallback: zod.output<Schema>,
  ): zod.output<Schema> {
    return (this.#files.get(path) as zod.output<Schema> | undefined) ?? fallback;
  }

  write(path: string, value: unknown): void {
    this.#files.set(path, value);
  }

  ensure(path: string, initial: unknown): void {
    this.#files.set(path, this.#files.get(path) ?? initial);
  }
}

// T-006, D-34: at most once a week per computer, and never once switched off.
describe("SupportNote", () => {
  it("gives the support sentence once, then again only 7 days later", () => {
    const clock = { now: () => Date.parse("2026-11-01T09:00:00.000Z") };
    const note = new SupportNote(new MemoryFiles(), clock, { file: "/home/support.json", enabled: true });
    const shownAt = clock.now();

    expect(note.due()).toBe(SENTENCE);

    clock.now = () => shownAt + 7 * DAY_MS - 1;
    expect(note.due()).toBeNull();

    clock.now = () => shownAt + 7 * DAY_MS;
    expect(note.due()).toBe(SENTENCE);
  });

  it("gives none while PIXELWRIGHT_SUPPORT_REMINDERS is off", () => {
    const note = new SupportNote(new MemoryFiles(), { now: () => 0 }, { file: "/home/support.json", enabled: false });

    expect(note.due()).toBeNull();
  });
});
