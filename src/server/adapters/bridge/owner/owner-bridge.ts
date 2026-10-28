import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LINK_TEXT, PLUGIN_LINK_ROLE } from "@/core/ports/plugin-link.constants.ts";
import type { ConnectedFile, OpRequest, PluginLink, PluginLinkState } from "@/core/ports/plugin-link.port.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints.ts";
import { BRIDGE_CONFIG } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { BRIDGE_LISTENER } from "@/server/adapters/bridge/listener/bridge-listener.ts";
import { OWNER_FAILURE } from "@/server/adapters/bridge/owner/owner.constants.ts";
import { SESSION_REGISTRY } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * The server that owns the bridge's port (A§4.1 step 5): bridge.json first, where keys and the peers' token live, then
 * the port. A bridge that cannot start keeps the reason for status instead of stopping the server. Its state is the
 * session registry's: the files connected, the windows waiting for a code, the plugins turned away.
 */
@injectable()
export class OwnerBridge implements PluginLink {
  readonly #listener;
  readonly #config;
  readonly #sessions;
  readonly #hints;
  #failure: string | null = null;

  constructor(
    listener = inject(BRIDGE_LISTENER),
    config = inject(BRIDGE_CONFIG),
    sessions = inject(SESSION_REGISTRY),
    hints = inject(STATUS_HINTS),
  ) {
    this.#listener = listener;
    this.#config = config;
    this.#sessions = sessions;
    this.#hints = hints;
  }

  async start(): Promise<void> {
    await this.take();
  }

  /** Takes the port: false when another program or server holds it, so the bridge joins it as a peer (S-030). */
  async take(): Promise<boolean> {
    try {
      this.#config.ensure();
      await this.#listener.listen();
      this.#failure = null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === OWNER_FAILURE.portTakenCode) {
        return false;
      }

      this.#failure = error instanceof Error ? error.message : String(error);
    }

    return true;
  }

  async close(): Promise<void> {
    await this.#listener.close();
  }

  files(): readonly ConnectedFile[] {
    return this.#sessions.files();
  }

  /** On that session's socket (S-042): no file connected is PLUGIN_NOT_CONNECTED, a session gone FILE_NOT_FOUND. */
  async request({ session, op, input, timeoutMs }: OpRequest): Promise<unknown> {
    const found = this.#sessions.find(session);

    if (found !== undefined) {
      return found.rpc.request(op, input, timeoutMs);
    }

    throw this.#sessions.files().length === 0
      ? new PixelwrightError(ERROR_CODE.pluginNotConnected, LINK_TEXT.notConnected)
      : new PixelwrightError(ERROR_CODE.fileNotFound, LINK_TEXT.sessionGone(session));
  }

  state(): PluginLinkState {
    const role = this.#failure === null ? PLUGIN_LINK_ROLE.owner : PLUGIN_LINK_ROLE.failed;
    const port = this.#listener.port();
    const pairing = this.#sessions.pairing();
    const files = this.#sessions.files();

    return {
      role,
      port,
      files,
      pairing,
      hint: this.#hints.hint({
        role,
        port,
        failure: this.#failure,
        closeCode: null,
        pairing,
        files: files.length,
        rejection: this.#sessions.rejection(),
        refusal: this.#sessions.refusal(),
      }),
    };
  }
}

/** The owner's role: PluginBridge takes it when the port is free, OwnerRouter serves the peers through it. */
export const OWNER_BRIDGE = new InjectionToken<OwnerBridge>("OwnerBridge");
