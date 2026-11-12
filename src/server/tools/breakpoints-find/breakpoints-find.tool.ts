import { inject, injectable } from "@needle-di/core";
import { BREAKPOINTS_FINDER } from "@/core/diff/breakpoints.ts";
import type { BreakpointsView } from "@/core/diff/diff.schema.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type BreakpointsFindInput,
  BreakpointsFindInputSchema,
} from "@/server/tools/breakpoints-find/breakpoints-find.schema.ts";
import { screensOp } from "@/shared/ops/screens/screens.manifest.ts";

/** breakpoints_find (T-087): the screens op gives the page's screens, core's Breakpoints finds the asked one's widths. */
@injectable()
export class BreakpointsFindTool extends Tool<BreakpointsFindInput, BreakpointsView> {
  protected readonly input = BreakpointsFindInputSchema;
  readonly #session;
  readonly #breakpoints;

  constructor(session = inject(PLUGIN_SESSION), breakpoints = inject(BREAKPOINTS_FINDER)) {
    super();
    this.#session = session;
    this.#breakpoints = breakpoints;
  }

  protected async run({ node }: BreakpointsFindInput): Promise<BreakpointsView> {
    return this.#breakpoints.of(await this.#session.run(screensOp, { node }));
  }
}
