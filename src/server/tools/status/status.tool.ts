import { inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK } from "../../../core/ports/plugin-link/plugin-link.port.ts";
import { CHANNEL } from "../../../shared/protocol/channel.constants.ts";
import { PROTOCOL } from "../../../shared/protocol/protocol.constants.ts";
import { VERSION } from "../../../shared/version/version.constants.ts";
import { Tool } from "../../app/tool-runner/tool/tool.ts";
import { type StatusInput, StatusInputSchema, type StatusOutput } from "./status.schema.ts";

/** Where this server stands: its version, channel and protocol, the bridge's role and port, and what to do next. */
@injectable()
export class StatusTool extends Tool<StatusInput, StatusOutput> {
  protected readonly input = StatusInputSchema;
  readonly #link;

  constructor(link = inject(PLUGIN_LINK)) {
    super();
    this.#link = link;
  }

  protected async run(): Promise<StatusOutput> {
    // Asking is what mints a pairing code while a plugin waits (S-020): status is the only caller.
    const { role, port, pairing, hint } = this.#link.state();

    return {
      server: {
        version: VERSION,
        channel: CHANNEL.name,
        role,
        protocol: PROTOCOL,
        port,
      },
      // shortcut: no files or probe until the bridge items give the link sessions (06) and ping (05).
      files: [],
      probe: null,
      pairing,
      hint,
    };
  }
}
