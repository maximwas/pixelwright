import { randomBytes } from "node:crypto";
import type { BaselineFile, RawTokens, Snapshot } from "@pixelwright/core";
import { SEEN_DESIGNS } from "./constants.ts";

/** A design a one-baseline diff compared: what baseline_save keeps when it is accepted. */
export interface SeenDesign {
  readonly name: string;
  readonly node: BaselineFile["node"];
  readonly file: BaselineFile["file"];
  readonly page: BaselineFile["page"];
  readonly plugin: string | null;
  readonly snapshot: Snapshot;
  readonly tokens: RawTokens | null;
  readonly capturedAt: string;
  /** The stored baseline's capturedAt when it was compared: a baseline saved again since makes the accept stale. */
  readonly baselineCapturedAt: string;
}

/**
 * The last few designs one-baseline diffs compared, each under the accept id its answer gave, so an accept keeps exactly
 * what was reviewed. Lost when the server stops.
 */
export class SeenDesigns {
  readonly #seen = new Map<string, SeenDesign>();

  keep(design: SeenDesign): string {
    const id = randomBytes(8).toString("hex");

    this.#seen.set(id, design);

    for (const oldest of this.#seen.keys()) {
      if (this.#seen.size <= SEEN_DESIGNS) {
        break;
      }

      this.#seen.delete(oldest);
    }

    return id;
  }

  get(id: string): SeenDesign | undefined {
    return this.#seen.get(id);
  }
}
