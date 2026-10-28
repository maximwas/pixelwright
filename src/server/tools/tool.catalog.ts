import { InjectionToken, injectable } from "@needle-di/core";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { CHANGES_SINCE_MANIFEST } from "@/server/tools/changes-since/changes-since.manifest.ts";
import { EXECUTE_MANIFEST } from "@/server/tools/execute/execute.manifest.ts";
import { SELECTION_GET_MANIFEST } from "@/server/tools/selection-get/selection-get.manifest.ts";
import { STATUS_MANIFEST } from "@/server/tools/status/status.manifest.ts";

/**
 * Every tool (Registry), in the order clients list them (T-009): finding and reading first, then the checks, then
 * writing, the guide last. One line per tool.
 */
@injectable()
export class ToolCatalog {
  readonly #manifests: readonly ToolManifest[] = [
    STATUS_MANIFEST,
    SELECTION_GET_MANIFEST,
    CHANGES_SINCE_MANIFEST,
    EXECUTE_MANIFEST,
  ];

  manifests(): readonly ToolManifest[] {
    return this.#manifests;
  }
}

export const TOOL_CATALOG = new InjectionToken<ToolCatalog>("ToolCatalog");
