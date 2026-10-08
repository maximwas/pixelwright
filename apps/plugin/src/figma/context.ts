import pluginPackage from "../../package.json" with { type: "json" };
import type { PluginContext } from "../types/messages.ts";

/** The file and page this plugin runs in. figma.fileKey is given to private plugins only. */
export function readContext(allowEdits: boolean): PluginContext {
  return {
    pluginVersion: pluginPackage.version,
    editorType: figma.editorType,
    file: {
      name: figma.root.name,
      key: figma.fileKey ?? null,
    },
    page: {
      id: figma.currentPage.id,
      name: figma.currentPage.name,
    },
    allowEdits,
  };
}
