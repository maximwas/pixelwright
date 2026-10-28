import * as zod from "zod/mini";
import { PLUGIN_INFO_CHARS } from "./protocol.constants.ts";

/**
 * Who the plugin is and where it runs: sent in hello, and later in every plugin info event (S-012). Every string is
 * bounded (S-010). The fields and their order are 0.7.0's (D-04).
 */
export const PluginInfoSchema = zod.object({
  /** Random per plugin window, kept across reconnects: a second hello with it replaces the old socket (S-011). */
  instanceId: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.instanceId)),
  pluginVersion: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.pluginVersion)),
  /** figma.editorType: "figma", or "dev" in Dev Mode. */
  editorType: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.editorType)),
  /** figma.fileKey is given to private plugins only, so the key is mostly null. */
  file: zod.object({
    name: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.fileName)),
    key: zod.nullable(zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.fileKey))),
  }),
  page: zod.object({
    id: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.pageId)),
    name: zod.string().check(zod.maxLength(PLUGIN_INFO_CHARS.pageName)),
  }),
  allowEdits: zod.boolean(),
  /** The plugin window's document is visible: its file tab is in front. */
  visible: zod.boolean(),
});
