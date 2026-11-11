import { InjectionToken, injectable } from "@needle-di/core";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { ASSETS_EXPORT_MANIFEST } from "@/server/tools/assets-export/assets-export.manifest.ts";
import { BASELINE_DIFF_MANIFEST } from "@/server/tools/baseline-diff/baseline-diff.manifest.ts";
import { BASELINE_SAVE_MANIFEST } from "@/server/tools/baseline-save/baseline-save.manifest.ts";
import { BREAKPOINTS_FIND_MANIFEST } from "@/server/tools/breakpoints-find/breakpoints-find.manifest.ts";
import { CHANGES_SINCE_MANIFEST } from "@/server/tools/changes-since/changes-since.manifest.ts";
import { COMPONENTS_READ_MANIFEST } from "@/server/tools/components-read/components-read.manifest.ts";
import { DESIGN_READ_MANIFEST } from "@/server/tools/design-read/design-read.manifest.ts";
import { EXECUTE_MANIFEST } from "@/server/tools/execute/execute.manifest.ts";
import { FILE_MAP_MANIFEST } from "@/server/tools/file-map/file-map.manifest.ts";
import { FLOW_READ_MANIFEST } from "@/server/tools/flow-read/flow-read.manifest.ts";
import { FONTS_CHECK_MANIFEST } from "@/server/tools/fonts-check/fonts-check.manifest.ts";
import { GUIDE_MANIFEST } from "@/server/tools/guide/guide.manifest.ts";
import { IMAGE_COMPARE_MANIFEST } from "@/server/tools/image-compare/image-compare.manifest.ts";
import { INSPECT_MANIFEST } from "@/server/tools/inspect/inspect.manifest.ts";
import { LIBRARY_SEARCH_MANIFEST } from "@/server/tools/library-search/library-search.manifest.ts";
import { MEASURE_MANIFEST } from "@/server/tools/measure/measure.manifest.ts";
import { NODE_SHOW_MANIFEST } from "@/server/tools/node-show/node-show.manifest.ts";
import { NODES_DIFF_MANIFEST } from "@/server/tools/nodes-diff/nodes-diff.manifest.ts";
import { NODES_FIND_MANIFEST } from "@/server/tools/nodes-find/nodes-find.manifest.ts";
import { OUTLINE_MANIFEST } from "@/server/tools/outline/outline.manifest.ts";
import { SCREENSHOT_MANIFEST } from "@/server/tools/screenshot/screenshot.manifest.ts";
import { SELECTION_GET_MANIFEST } from "@/server/tools/selection-get/selection-get.manifest.ts";
import { SELECTION_WAIT_MANIFEST } from "@/server/tools/selection-wait/selection-wait.manifest.ts";
import { STATUS_MANIFEST } from "@/server/tools/status/status.manifest.ts";
import { STYLES_COMPARE_MANIFEST } from "@/server/tools/styles-compare/styles-compare.manifest.ts";
import { TOKENS_READ_MANIFEST } from "@/server/tools/tokens-read/tokens-read.manifest.ts";
import { TOKENS_USAGE_MANIFEST } from "@/server/tools/tokens-usage/tokens-usage.manifest.ts";
import { TYPES_READ_MANIFEST } from "@/server/tools/types-read/types-read.manifest.ts";
import { VARIANTS_READ_MANIFEST } from "@/server/tools/variants-read/variants-read.manifest.ts";
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
    IMAGE_COMPARE_MANIFEST,
    STYLES_COMPARE_MANIFEST,
    INSPECT_MANIFEST,
    MEASURE_MANIFEST,
    NODES_DIFF_MANIFEST,
    BASELINE_SAVE_MANIFEST,
    BASELINE_DIFF_MANIFEST,
    BREAKPOINTS_FIND_MANIFEST,
    FLOW_READ_MANIFEST,
    VARIANTS_READ_MANIFEST,
    FONTS_CHECK_MANIFEST,
    EXECUTE_MANIFEST,
    TYPES_READ_MANIFEST,
    TOKENS_READ_MANIFEST,
    TOKENS_USAGE_MANIFEST,
    COMPONENTS_READ_MANIFEST,
    LIBRARY_SEARCH_MANIFEST,
    ASSETS_EXPORT_MANIFEST,
    GUIDE_MANIFEST,
  ];

  manifests(): readonly ToolManifest[] {
    return this.#manifests;
  }

  /** What an execute script's pw calls: every read but guide and types_read, which describe Pixelwright, not the file. */
  reads(): readonly ToolManifest[] {
    const apart = new Set([GUIDE_MANIFEST.name, TYPES_READ_MANIFEST.name]);

    return this.#manifests.filter(({ name, annotations }) => annotations.readOnlyHint && !apart.has(name));
  }
}

export const TOOL_CATALOG = new InjectionToken<ToolCatalog>("ToolCatalog");
