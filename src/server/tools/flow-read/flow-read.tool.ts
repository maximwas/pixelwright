import { inject, injectable } from "@needle-di/core";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { FLOW_LINKS } from "@/server/tools/flow-read/flow-links.ts";
import { type FlowMap, type FlowReadInput, FlowReadInputSchema } from "@/server/tools/flow-read/flow-read.schema.ts";
import { flowsOp } from "@/shared/ops/flows/flows.manifest.ts";

/** flow_read (T-088): the flows op reads the page's prototype, FlowLinks maps it. Reads only. */
@injectable()
export class FlowReadTool extends Tool<FlowReadInput, FlowMap> {
  protected readonly input = FlowReadInputSchema;
  readonly #session;
  readonly #links;

  constructor(session = inject(PLUGIN_SESSION), links = inject(FLOW_LINKS)) {
    super();
    this.#session = session;
    this.#links = links;
  }

  protected async run({ page }: FlowReadInput): Promise<FlowMap> {
    return this.#links.map(await this.#session.run(flowsOp, page === undefined ? {} : { page }));
  }
}
