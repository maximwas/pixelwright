import { inject, injectable } from "@needle-di/core";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type ViewportGetInput,
  ViewportGetInputSchema,
  type ViewportGetOutput,
} from "@/server/tools/viewport-get/viewport-get.schema.ts";
import { viewportOp } from "@/shared/ops/viewport/viewport.manifest.ts";

/** What the user sees in the call's file (T-033), as the plugin's viewport op reads it. */
@injectable()
export class ViewportGetTool extends Tool<ViewportGetInput, ViewportGetOutput> {
  protected readonly input = ViewportGetInputSchema;
  readonly #session;

  constructor(session = inject(PLUGIN_SESSION)) {
    super();
    this.#session = session;
  }

  protected run(): Promise<ViewportGetOutput> {
    return this.#session.run(viewportOp, {});
  }
}
