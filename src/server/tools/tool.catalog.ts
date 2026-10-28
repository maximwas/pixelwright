import { InjectionToken, injectable } from "@needle-di/core";
import type { ToolManifest } from "../app/tool-runner/tool-manifest.types.ts";
import { STATUS_MANIFEST } from "./status/status.manifest.ts";

/**
 * Every tool (Registry), in the order clients list them (T-009): finding and reading first, then the checks, then
 * writing, the guide last. One line per tool.
 */
@injectable()
export class ToolCatalog {
  readonly #manifests: readonly ToolManifest[] = [STATUS_MANIFEST];

  manifests(): readonly ToolManifest[] {
    return this.#manifests;
  }

  /** A tool's name for a sentence that names it, checked against the catalog (D-31), so a renamed tool fails here. */
  nameOf(name: string): string {
    if (!this.#manifests.some((manifest) => manifest.name === name)) {
      throw new Error(`No tool is named ${name}.`);
    }

    return name;
  }
}

export const TOOL_CATALOG = new InjectionToken<ToolCatalog>("ToolCatalog");
