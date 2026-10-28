import type { Container } from "@needle-di/core";
import { PLUGIN_SESSION, type PluginSession } from "@/server/app/sessions/plugin-session.ts";
import type { Tool } from "@/server/app/tool-runner/tool.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOOL_CONTEXT, type ToolContext, type ToolFactory } from "@/server/app/tool-runner/tool-runner.ts";

/**
 * Factory: one tool per call, built in a child container that holds the call's context and, for a tool that takes
 * `file`, the session it is bound to, so the root keeps its singletons and each call gets its own tool. It sits beside
 * the root, the only other place that holds the container.
 */
export class ContainerToolFactory implements ToolFactory {
  readonly #root: Container;

  constructor(root: Container) {
    this.#root = root;
  }

  async create(
    manifest: ToolManifest,
    context: ToolContext,
    session?: PluginSession,
  ): Promise<Tool> {
    const toolClass = await manifest.load();
    const child = this.#root.createChild().bind({ provide: TOOL_CONTEXT, useValue: context });

    if (session !== undefined) {
      child.bind({ provide: PLUGIN_SESSION, useValue: session });
    }

    // The one place a tool is asked for by its class: a fresh instance per call is the point (needle-di #110).
    return child.get(toolClass);
  }
}
