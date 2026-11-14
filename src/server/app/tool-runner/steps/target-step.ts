import { inject, injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { PLUGIN_ARRIVALS } from "@/core/ports/plugin-arrivals.port.ts";
import { LINK_TEXT, PLUGIN_ARRIVAL } from "@/core/ports/plugin-link.constants.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { PLUGIN_SESSIONS } from "@/server/app/sessions/plugin-sessions.ts";
import { TargetArgsSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import type { ToolAnswer, ToolCall, ToolCallStep, ToolStepNext } from "@/server/app/tool-runner/tool-runner.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * Binds a call that takes `file` to one plugin session before the tool's code loads (A§6.1 steps 2-3, T-002): no file
 * connected, a name two files share, or one no file has fails here, before any work. A call that finds no file connected
 * first waits for the plugin when one is on its way back (a server just up, a file just gone); a tool that finds its
 * own files (`ownTarget`) is let through unbound and never waits.
 */
@injectable()
export class TargetStep implements ToolCallStep {
  readonly #sessions;
  readonly #link;
  readonly #arrivals;

  constructor(
    sessions = inject(PLUGIN_SESSIONS),
    link = inject(PLUGIN_LINK),
    arrivals = inject(PLUGIN_ARRIVALS),
  ) {
    this.#sessions = sessions;
    this.#link = link;
    this.#arrivals = arrivals;
  }

  async handle(call: ToolCall, next: ToolStepNext): Promise<ToolAnswer> {
    if (call.manifest.input.shape.file === undefined || (call.manifest.ownTarget ?? false)) {
      return next(call);
    }

    const args = zod.safeParse(TargetArgsSchema, call.args);

    await this.#waitForPlugin();

    return next({ ...call, session: this.#sessions.session(args.success ? args.data.file : undefined) });
  }

  /** No file connected: wait while the plugin is expected; a wait that ends after a file was there says it left. */
  async #waitForPlugin(): Promise<void> {
    if (this.#link.files().length > 0) {
      return;
    }

    if ((await this.#arrivals.wait()) === PLUGIN_ARRIVAL.left) {
      throw new PixelwrightError(ERROR_CODE.pluginNotConnected, LINK_TEXT.pluginLeft);
    }
  }
}
