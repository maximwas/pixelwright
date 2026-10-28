import type * as zod from "zod/mini";
import type { Tool } from "@/server/app/tool-runner/tool/tool.ts";

/** MCP tool annotations: clients ask before a destructive call (S-053). */
interface ToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint: boolean;
  readonly openWorldHint: boolean;
}

/** A tool class: built per call by the tool factory, its dependencies injected. */
type ToolClass = new () => Tool;

/** A tool's data, as clients list it; its code loads on the first call. */
export interface ToolManifest {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: zod.ZodMiniObject;
  readonly output: zod.ZodMiniObject;
  readonly annotations: ToolAnnotations;
  readonly load: () => Promise<ToolClass>;
}
