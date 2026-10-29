import { inject, injectable } from "@needle-di/core";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type ChangesSinceInput,
  ChangesSinceInputSchema,
  type ChangesSinceOutput,
} from "@/server/tools/changes-since/changes-since.schema.ts";
import { changesOp } from "@/shared/ops/changes/changes.manifest.ts";

/** What changed in the call's file since the plugin started watching, or since a cursor (T-035), from its journal. */
@injectable()
export class ChangesSinceTool extends Tool<ChangesSinceInput, ChangesSinceOutput> {
  protected readonly input = ChangesSinceInputSchema;
  readonly #session;

  constructor(session = inject(PLUGIN_SESSION)) {
    super();
    this.#session = session;
  }

  protected run({ cursor }: ChangesSinceInput): Promise<ChangesSinceOutput> {
    return this.#session.run(changesOp, cursor === undefined ? {} : { since: cursor });
  }
}
