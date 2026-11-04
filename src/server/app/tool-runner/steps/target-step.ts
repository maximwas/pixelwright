import { inject, injectable } from "@needle-di/core";
import * as zod from "zod/mini";
import { PLUGIN_SESSIONS } from "@/server/app/sessions/plugin-sessions.ts";
import { TargetArgsSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import type { ToolAnswer, ToolCall, ToolCallStep, ToolStepNext } from "@/server/app/tool-runner/tool-runner.ts";

/**
 * Binds a call that takes `file` to one plugin session before the tool's code loads (A§6.1 steps 2-3, T-002): no file
 * connected, a name two files share, or one no file has fails here, before any work. A tool that finds its own files
 * (`ownTarget`) is let through unbound.
 */
@injectable()
export class TargetStep implements ToolCallStep {
  readonly #sessions;

  constructor(sessions = inject(PLUGIN_SESSIONS)) {
    this.#sessions = sessions;
  }

  async handle(call: ToolCall, next: ToolStepNext): Promise<ToolAnswer> {
    if (call.manifest.input.shape.file === undefined || (call.manifest.ownTarget ?? false)) {
      return next(call);
    }

    const args = zod.safeParse(TargetArgsSchema, call.args);

    return next({ ...call, session: this.#sessions.session(args.success ? args.data.file : undefined) });
  }
}
