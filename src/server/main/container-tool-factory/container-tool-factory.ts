import type { Container } from "@needle-di/core";
import type { Tool } from "@/server/app/tool-runner/tool/tool.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOOL_CONTEXT } from "@/server/app/tool-runner/tool-runner/tool-runner.tokens.ts";
import type { ToolContext, ToolFactory } from "@/server/app/tool-runner/tool-runner/tool-runner.types.ts";

/**
 * Factory: one tool per call, built in a child container that holds the call's context, so the root keeps its
 * singletons and each call gets its own tool. It sits beside the root, the only other place that holds the container.
 */
export class ContainerToolFactory implements ToolFactory {
  readonly #root: Container;

  constructor(root: Container) {
    this.#root = root;
  }

  async create(
    manifest: ToolManifest,
    context: ToolContext,
  ): Promise<Tool> {
    const toolClass = await manifest.load();

    // The one place a tool is asked for by its class: a fresh instance per call is the point (needle-di #110).
    return this.#root
      .createChild()
      .bind({
        provide: TOOL_CONTEXT,
        useValue: context,
      })
      .get(toolClass);
  }
}
