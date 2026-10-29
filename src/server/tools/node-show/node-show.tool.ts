import { inject, injectable } from "@needle-di/core";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type NodeShowInput,
  NodeShowInputSchema,
  type NodeShowOutput,
} from "@/server/tools/node-show/node-show.schema.ts";
import { showOp } from "@/shared/ops/show/show.manifest.ts";

/** Layers into view in the call's file, selected unless told not to (T-032), by the plugin's show op. */
@injectable()
export class NodeShowTool extends Tool<NodeShowInput, NodeShowOutput> {
  protected readonly input = NodeShowInputSchema;
  readonly #session;

  constructor(session = inject(PLUGIN_SESSION)) {
    super();
    this.#session = session;
  }

  protected run({ file, ...show }: NodeShowInput): Promise<NodeShowOutput> {
    return this.#session.run(showOp, show);
  }
}
