import { inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK } from "../../../core/ports/plugin-link.port.ts";
import { CHANNEL } from "../../../shared/protocol/channel.constants.ts";
import { PROTOCOL } from "../../../shared/protocol/protocol.constants.ts";
import { VERSION } from "../../../shared/version/version.constants.ts";
import { Tool } from "../../app/tool-runner/tool.ts";
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
    const { role, port, hint } = this.#link.state();

    return {
      server: {
        version: VERSION,
        channel: CHANNEL.name,
        role,
        protocol: PROTOCOL,
        port,
      },
      // shortcut: no files, probe or pairing until the bridge items give the link sessions (06), ping (05), pairing (02).
      files: [],
      probe: null,
      pairing: null,
      hint,
    };
  }
}
