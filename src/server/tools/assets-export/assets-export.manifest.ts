import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { ASSETS_EXPORT_TOOL } from "@/server/tools/assets-export/assets-export.constants.ts";
import {
  AssetsExportInputSchema,
  AssetsExportOutputSchema,
} from "@/server/tools/assets-export/assets-export.schema.ts";

/** Read-only: it reads Figma and writes local files only, never over other bytes (T-194). */
export const ASSETS_EXPORT_MANIFEST: ToolManifest = {
  name: ASSETS_EXPORT_TOOL.name,
  title: ASSETS_EXPORT_TOOL.title,
  description: ASSETS_EXPORT_TOOL.description,
  input: AssetsExportInputSchema,
  output: AssetsExportOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/assets-export/assets-export.tool.ts")).AssetsExportTool,
};
