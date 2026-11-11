import { InjectionToken } from "@needle-di/core";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";

/** pw's functions by their pw names (the tools' camelCase), each the read tool it runs (the composition root binds them). */
export const PW_TOOLS = new InjectionToken<ReadonlyMap<string, ToolManifest>>("PwTools");
