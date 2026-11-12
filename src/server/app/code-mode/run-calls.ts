import pLimit from "p-limit";
import { CODE_LIMITS, CODE_TEXT } from "@/server/app/code-mode/code-mode.constants.ts";
import type { Clamp, ToolImage } from "@/server/app/code-mode/code-mode.types.ts";
import type { PwCalls } from "@/server/app/code-mode/pw-bridge.ts";

/**
 * One run's pw calls: at most 50, at most 4 in flight (p-limit 7.3.3 queues the rest), each with the run's signal;
 * those that succeeded counted by function, the characters they answered summed, the arguments clamped kept, their
 * images kept under handles (`image-1`) that the result can name.
 */
export class RunCalls {
  readonly #calls: PwCalls;
  readonly #signal: AbortSignal;
  readonly #file: string | undefined;
  readonly #limit = pLimit(CODE_LIMITS.inFlight);
  readonly #done = new Map<string, number>();
  readonly #images = new Map<string, ToolImage>();
  readonly #clamped: Clamp[] = [];
  #made = 0;
  #innerChars = 0;

  constructor(
    calls: PwCalls,
    signal: AbortSignal,
    file?: string,
  ) {
    this.#calls = calls;
    this.#signal = signal;
    this.#file = file;
  }

  async call(name: string, args: unknown): Promise<unknown> {
    this.#made += 1;

    if (this.#made > CODE_LIMITS.calls) {
      throw new Error(CODE_TEXT.tooManyCalls(name));
    }

    const {
      value,
      images: [image],
      clamped = [],
    } = await this.#limit(async () => {
      // A call still queued when the run ended (or stopped) never reaches the plugin.
      this.#signal.throwIfAborted();

      return await this.#calls.call(name, args, this.#signal, this.#file);
    });
    const key = CODE_TEXT.call(name);

    this.#innerChars += JSON.stringify(value).length;
    this.#clamped.push(...clamped);
    this.#done.set(key, (this.#done.get(key) ?? 0) + 1);

    return image === undefined ? value : { ...value, image: this.#keep(image) };
  }

  /** The calls that succeeded, by function. */
  tally(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.#done);
  }

  /** The arguments the bridge set to their bounds, in the order of the calls. */
  clamped(): readonly Clamp[] {
    return this.#clamped;
  }

  /** pw calls made, the 51st refused one included. */
  made(): number {
    return this.#made;
  }

  /** Characters of every value pw answered inside the run: with what the run returns, the filtering's gain. */
  innerChars(): number {
    return this.#innerChars;
  }

  /** The images the result names, in the order the run took them: the first four shown, the rest named. */
  named(result: unknown): { readonly images: readonly ToolImage[]; readonly notShown: readonly string[] } {
    const strings = new Set<string>();

    this.#strings(result, strings);

    const handles = [...this.#images.keys()].filter((handle) => strings.has(handle));

    return {
      images: handles.slice(0, CODE_LIMITS.images).flatMap((handle) => this.#images.get(handle) ?? []),
      notShown: handles.slice(CODE_LIMITS.images),
    };
  }

  #keep(image: ToolImage): string {
    const handle = CODE_TEXT.handle(this.#images.size + 1);

    this.#images.set(handle, image);

    return handle;
  }

  #strings(value: unknown, into: Set<string>): void {
    if (typeof value === "string") {
      into.add(value);
    } else if (typeof value === "object" && value !== null) {
      for (const item of Object.values(value)) {
        this.#strings(item, into);
      }
    }
  }
}
