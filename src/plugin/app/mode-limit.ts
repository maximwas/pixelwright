import { InjectionToken, injectable } from "@needle-di/core";
import { MODE_LIMIT_REFUSAL } from "@/plugin/app/app.constants.ts";

/**
 * The modes one collection may have under the file's Figma plan (P-167, FX-054): the Plugin API names no plan and no
 * limit, so it is learned from Figma's refusal of a mode, never probed by writing, and kept while the plugin runs in
 * the file; a dry run then refuses a mode past it (B-055).
 */
@injectable()
export class ModeLimit {
  #known: number | null = null;

  /** The limit Figma refused a mode at, or null before any refusal. */
  known(): number | null {
    return this.#known;
  }

  /** The limit a refusal names, learned; null for a refusal of another kind. */
  learn(message: string): number | null {
    const limit = MODE_LIMIT_REFUSAL.exec(message)?.[1];

    if (limit === undefined) {
      return null;
    }

    this.#known = Number(limit);

    return this.#known;
  }
}

export const MODE_LIMIT = new InjectionToken<ModeLimit>("ModeLimit");
