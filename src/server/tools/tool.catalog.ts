import { InjectionToken, injectable } from "@needle-di/core";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { CHANGES_SINCE_MANIFEST } from "@/server/tools/changes-since/changes-since.manifest.ts";
import { DESIGN_READ_MANIFEST } from "@/server/tools/design-read/design-read.manifest.ts";
import { EXECUTE_MANIFEST } from "@/server/tools/execute/execute.manifest.ts";
import { FILE_MAP_MANIFEST } from "@/server/tools/file-map/file-map.manifest.ts";
import { NODE_SHOW_MANIFEST } from "@/server/tools/node-show/node-show.manifest.ts";
import { NODES_FIND_MANIFEST } from "@/server/tools/nodes-find/nodes-find.manifest.ts";
import { OUTLINE_MANIFEST } from "@/server/tools/outline/outline.manifest.ts";
import { SCREENSHOT_MANIFEST } from "@/server/tools/screenshot/screenshot.manifest.ts";
import { SELECTION_GET_MANIFEST } from "@/server/tools/selection-get/selection-get.manifest.ts";
import { SELECTION_WAIT_MANIFEST } from "@/server/tools/selection-wait/selection-wait.manifest.ts";
import { STATUS_MANIFEST } from "@/server/tools/status/status.manifest.ts";
import { VIEWPORT_GET_MANIFEST } from "@/server/tools/viewport-get/viewport-get.manifest.ts";

/**
 * Every tool (Registry), in the order clients list them (T-009): finding and reading first, then the checks, then
 * writing, the guide last. One line per tool.
 */
@injectable()
export class ToolCatalog {
  readonly #manifests: readonly ToolManifest[] = [
    STATUS_MANIFEST,
    SELECTION_GET_MANIFEST,
    NODE_SHOW_MANIFEST,
    SELECTION_WAIT_MANIFEST,
    CHANGES_SINCE_MANIFEST,
    FILE_MAP_MANIFEST,
    VIEWPORT_GET_MANIFEST,
    NODES_FIND_MANIFEST,
    OUTLINE_MANIFEST,
    SCREENSHOT_MANIFEST,
    DESIGN_READ_MANIFEST,
    EXECUTE_MANIFEST,
  ];

  manifests(): readonly ToolManifest[] {
    return this.#manifests;
  }
}

export const TOOL_CATALOG = new InjectionToken<ToolCatalog>("ToolCatalog");
