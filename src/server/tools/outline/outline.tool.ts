import { inject, injectable } from "@needle-di/core";
import { OUTLINE_XML } from "@/core/xml/outline/outline-xml.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { type OutlineInput, OutlineInputSchema, type OutlineOutput } from "@/server/tools/outline/outline.schema.ts";
import { outlineOp } from "@/shared/ops/outline/outline.manifest.ts";

/** The layer tree in the call's file (T-044): the plugin's outline op reads it, core writes it as light XML. */
@injectable()
export class OutlineTool extends Tool<OutlineInput, OutlineOutput> {
  protected readonly input = OutlineInputSchema;
  readonly #session;
  readonly #outline;

  constructor(session = inject(PLUGIN_SESSION), outline = inject(OUTLINE_XML)) {
    super();
    this.#session = session;
    this.#outline = outline;
  }

  protected async run({ file, ...request }: OutlineInput): Promise<OutlineOutput> {
    const { root } = await this.#session.run(outlineOp, request);

    return { xml: this.#outline.xml(root), nodes: this.#outline.count(root) };
  }
}
