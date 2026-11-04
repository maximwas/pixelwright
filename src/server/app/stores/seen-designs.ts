import { randomBytes } from "node:crypto";
import { InjectionToken, injectable } from "@needle-di/core";
import { SEEN_DESIGN_IDS } from "@/server/app/stores/stores.constants.ts";
import type { BaselineFile } from "@/server/app/stores/stores.schema.ts";

/** A design a one-baseline diff compared: what baseline_save keeps when it is accepted. */
export interface SeenDesign {
  readonly name: string;
  readonly node: BaselineFile["node"];
  readonly file: BaselineFile["file"];
  readonly page: BaselineFile["page"];
  readonly plugin: string | null;
  readonly snapshot: BaselineFile["snapshot"];
  readonly tokens: BaselineFile["tokens"];
  readonly capturedAt: string;
  /** The stored baseline's capturedAt when it was compared: a baseline saved again since makes the accept stale. */
  readonly baselineCapturedAt: string;
}

/**
 * The last designs one-baseline diffs compared (T-202, D-39), each under the accept id its answer gave, so an accept
 * keeps exactly what was reviewed. In memory: an accept follows its diff in the same session, and a restart loses them.
 */
@injectable()
export class SeenDesigns {
  readonly #seen = new Map<string, SeenDesign>();

  keep(design: SeenDesign): string {
    const id = randomBytes(SEEN_DESIGN_IDS.bytes).toString(SEEN_DESIGN_IDS.encoding);
    const [oldest] = this.#seen.keys();

    this.#seen.set(id, design);

    if (this.#seen.size > SEEN_DESIGN_IDS.kept && oldest !== undefined) {
      this.#seen.delete(oldest);
    }

    return id;
  }

  get(id: string): SeenDesign | undefined {
    return this.#seen.get(id);
  }
}

export const SEEN_DESIGNS = new InjectionToken<SeenDesigns>("SeenDesigns");
