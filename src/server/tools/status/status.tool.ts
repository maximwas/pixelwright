import { inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { PLUGIN_LINK, type ProbeResult } from "@/core/ports/plugin-link.port.ts";
import { PLUGIN_SESSIONS } from "@/server/app/sessions/plugin-sessions.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import { STATUS_NOTE } from "@/server/tools/status/status.constants.ts";
import { type StatusInput, StatusInputSchema, type StatusOutput } from "@/server/tools/status/status.schema.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { PROTOCOL } from "@/shared/protocol/protocol.constants.ts";
import { VERSION } from "@/shared/version/version.constants.ts";

/**
 * Where this server stands (T-020): its version, channel and protocol, the bridge's role and port, the connected files,
 * what to do next, and a note for files Figma gives no key (T-023). The probe pings the active file the way every op
 * goes, so it works from a peer too.
 */
@injectable()
export class StatusTool extends Tool<StatusInput, StatusOutput> {
  protected readonly input = StatusInputSchema;
  readonly #link;
  readonly #sessions;
  readonly #clock;

  constructor(
    link = inject(PLUGIN_LINK),
    sessions = inject(PLUGIN_SESSIONS),
    clock = inject(CLOCK),
  ) {
    super();
    this.#link = link;
    this.#sessions = sessions;
    this.#clock = clock;
  }

  protected async run(input: StatusInput): Promise<StatusOutput> {
    // Asking is what mints a pairing code while a plugin waits (S-020): status is the only caller.
    const { role, port, files, pairing, hint } = this.#link.state();
    const keyless = files.filter((file) => file.key === null).map((file) => file.name);

    return {
      server: { version: VERSION, channel: CHANNEL.name, role, protocol: PROTOCOL, port },
      files: [...files],
      probe: input.probe ? await this.#probe() : null,
      pairing,
      hint,
      ...(keyless.length > 0 ? { note: STATUS_NOTE.keyless(keyless.join(STATUS_NOTE.separator)) } : {}),
    };
  }

  /** One ping to the active file's plugin (T-021), rounded to the ms, or why it failed. */
  async #probe(): Promise<ProbeResult> {
    const started = this.#clock.now();

    try {
      await this.#sessions.session(undefined).run(pingOp, {});

      return { ok: true, ms: Math.round(this.#clock.now() - started), error: null };
    } catch (error) {
      return { ok: false, ms: null, error: error instanceof PixelwrightError ? error.text() : String(error) };
    }
  }
}
