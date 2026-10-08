import { BridgeError } from "@pixelwright/core";
import { PEER_RETRY_MS } from "../constants/bridge.ts";
import type {
  BridgeState,
  BridgeStatus,
  ConnectedPlugin,
  PluginLink,
  RequestOptions,
  UpgradeRejection,
} from "../types/bridge.ts";
import type { Logger } from "../types/logging.ts";
import { errorMessage } from "../utils/error-message.ts";
import type { BridgeServer } from "./bridge-server.ts";
import { bridgeHint } from "./hints.ts";
import type { OwnerClient } from "./owner-client.ts";

interface PluginBridgeOptions {
  readonly port: number;
  readonly logger: Logger;
}

const failedState = (error: unknown): BridgeState => ({
  kind: "failed",
  reason: errorMessage(error),
});

/**
 * This process's way to the Figma plugins. Every Claude Code session runs its own pixelwright process, and the plugins
 * serve them all: the first process owns the bridge port, the others join it as peers. When the owner goes away, the
 * others take the port over or join the new owner, and the plugins reconnect on their own.
 */
export class PluginBridge {
  readonly #server: BridgeServer | null;
  readonly #owner: OwnerClient | null;
  readonly #options: PluginBridgeOptions;
  #state: BridgeState;
  #lastRejection: UpgradeRejection | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #closed = false;

  /** The bridge is off: PIXELWRIGHT_PLUGIN_BRIDGE=off. */
  static disabled(options: PluginBridgeOptions): PluginBridge {
    return new PluginBridge(null, null, { kind: "disabled" }, options);
  }

  /** The bridge could not be set up, for example because bridge.json is broken. */
  static failed(error: unknown, options: PluginBridgeOptions): PluginBridge {
    return new PluginBridge(null, null, failedState(error), options);
  }

  /** Takes the bridge port, or joins the process that owns it; keeps trying in the background until one works. */
  static async connect(server: BridgeServer, owner: OwnerClient, options: PluginBridgeOptions): Promise<PluginBridge> {
    const bridge = new PluginBridge(
      server,
      owner,
      {
        kind: "unavailable",
        closeCode: null,
      },
      options,
    );

    await bridge.#connect();

    return bridge;
  }

  private constructor(
    server: BridgeServer | null,
    owner: OwnerClient | null,
    state: BridgeState,
    options: PluginBridgeOptions,
  ) {
    this.#server = server;
    this.#owner = owner;
    this.#state = state;
    this.#options = options;
    server?.on("rejected", (rejection) => {
      this.#lastRejection = rejection;
    });
    server?.on("changed", () => {
      if (server.plugins().length > 0) {
        this.#lastRejection = null;
      }
    });
  }

  status(): BridgeStatus {
    return {
      role: this.#state.kind,
      port: this.#options.port,
      hint: bridgeHint(this.#state, this.plugins().length, this.#lastRejection, this.#options.port),
    };
  }

  plugins(): readonly ConnectedPlugin[] {
    return this.#link()?.plugins() ?? [];
  }

  request(op: string, input: unknown, options: RequestOptions = {}): Promise<unknown> {
    const link = this.#link();

    if (link === null) {
      return Promise.reject(
        new BridgeError("PLUGIN_NOT_CONNECTED", this.status().hint ?? "The plugin bridge is not running."),
      );
    }

    return link.request(op, input, options);
  }

  close(): Promise<void> {
    this.#closed = true;
    clearTimeout(this.#retryTimer);
    this.#owner?.close();

    return this.#server?.close() ?? Promise.resolve();
  }

  /** How this process reaches the plugins now: as the owner, through the owner, or not at all. */
  #link(): PluginLink | null {
    switch (this.#state.kind) {
      case "owner":
        return this.#server;
      case "peer":
        return this.#owner;
      default:
        return null;
    }
  }

  /** Takes the port if it is free, joins its owner if not, and tries again later if neither works. */
  async #connect(): Promise<void> {
    const server = this.#server;
    const owner = this.#owner;

    if (server === null || owner === null || this.#closed) {
      return;
    }

    let port: number | null;

    try {
      port = await server.listen();
    } catch (error) {
      this.#options.logger.error({ err: error }, "Plugin bridge failed to start");
      this.#state = failedState(error);

      return;
    }

    if (this.#closed) {
      await server.close();

      return;
    }

    if (port !== null) {
      this.#state = { kind: "owner" };
      this.#options.logger.info({ port }, "Plugin bridge listening on 127.0.0.1: this session owns it");

      return;
    }

    await this.#join(owner);
  }

  async #join(owner: OwnerClient): Promise<void> {
    const joined = await owner.join(() => this.#ownerLost());

    if (this.#closed) {
      owner.close();

      return;
    }

    if (joined) {
      this.#state = { kind: "peer" };
      this.#options.logger.info("Joined the plugin bridge of another Claude Code session");

      return;
    }

    this.#state = {
      kind: "unavailable",
      closeCode: owner.lastCloseCode,
    };
    this.#retryLater();
  }

  /** The owner's session ended: this process takes the port over, or joins whichever process did. */
  #ownerLost(): void {
    this.#state = {
      kind: "unavailable",
      closeCode: null,
    };
    this.#options.logger.info("The plugin bridge's owner went away; taking over or joining the next owner");
    this.#retryLater();
  }

  /** Jittered, so the sessions left behind do not all try the same moment. */
  #retryLater(): void {
    if (this.#closed) {
      return;
    }

    clearTimeout(this.#retryTimer);
    this.#retryTimer = setTimeout(() => void this.#connect(), PEER_RETRY_MS * (0.5 + Math.random()));
    this.#retryTimer.unref();
  }
}
