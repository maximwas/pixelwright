import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SocketOpener } from "@/plugin-ui/link/socket-link.ts";
import { BridgeConfig } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { PairingCodes } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import { PluginConnection } from "@/server/adapters/bridge/plugin/plugin-connection.ts";
import { SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry.ts";
import { AtomicJsonFile } from "@/server/adapters/files/atomic-json-file.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger.ts";
import { MemorySocket } from "@/shared/protocol/memory-socket.ts";

/**
 * Item 03's owner end, real: bridge.json in a temp home, pairing codes, sessions, and a real PluginConnection on the
 * server end of each linked memory socket the window's link opens. Both ends of every socket are kept.
 */
export class MemoryBridge implements SocketOpener {
  readonly plugins: MemorySocket[] = [];
  readonly servers: MemorySocket[] = [];
  readonly logger = new PinoLogger({ level: "silent", file: "unused" }, []);

  readonly clock = { now: () => Date.now() };
  readonly pairing = new PairingCodes(this.clock, this.logger);
  readonly sessions = new SessionRegistry(this.pairing, this.logger);
  readonly keys = new BridgeConfig(
    new AtomicJsonFile(this.logger),
    { port: 0, pluginOrigins: [], configFile: join(mkdtempSync(join(tmpdir(), "pixelwright-link-")), "bridge.json") },
    this.clock,
  );

  open(): MemorySocket {
    const [plugin, server] = MemorySocket.pair();

    new PluginConnection(server, {
      keys: this.keys,
      pairing: this.pairing,
      sessions: this.sessions,
      logger: this.logger,
    }).start();
    this.plugins.push(plugin);
    this.servers.push(server);

    return plugin;
  }

  /** The code status shows the user while a window waits. */
  code(): string {
    return this.sessions.pairing()?.code ?? "";
  }
}
