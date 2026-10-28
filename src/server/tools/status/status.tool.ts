import { inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { Tool } from "@/server/app/tool-runner/tool/tool.ts";
import { type StatusInput, StatusInputSchema, type StatusOutput } from "@/server/tools/status/status.schema.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { PROTOCOL } from "@/shared/protocol/protocol.constants.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/** Where this server stands: its version, channel and protocol, the bridge's role and port, and what to do next. */
@injectable()
export class StatusTool extends Tool<StatusInput, StatusOutput> {
  protected readonly input = StatusInputSchema;
  readonly #link;

  constructor(link = inject(PLUGIN_LINK)) {
    super();
    this.#link = link;
  }

  protected async run(input: StatusInput): Promise<StatusOutput> {
    // Asking is what mints a pairing code while a plugin waits (S-020): status is the only caller.
    const { role, port, files, pairing, hint } = this.#link.state();

    return {
      server: {
        version: VERSION,
        channel: CHANNEL.name,
        role,
        protocol: PROTOCOL,
        port,
      },
      files: [...files],
      probe: input.probe ? await this.#link.probe() : null,
      pairing,
      hint,
    };
  }
}
