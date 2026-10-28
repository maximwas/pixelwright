import { inject, injectable } from "@needle-di/core";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type SelectionGetInput,
  SelectionGetInputSchema,
  type SelectionGetOutput,
} from "@/server/tools/selection-get/selection-get.schema.ts";
import { selectionOp } from "@/shared/ops/selection/selection.manifest.ts";

/** The layers the user selected in the call's file (T-030), as the plugin's selection op reads them. */
@injectable()
export class SelectionGetTool extends Tool<SelectionGetInput, SelectionGetOutput> {
  protected readonly input = SelectionGetInputSchema;
  readonly #session;

  constructor(session = inject(PLUGIN_SESSION)) {
    super();
    this.#session = session;
  }

  protected run(): Promise<SelectionGetOutput> {
    return this.#session.run(selectionOp, {});
  }
}
