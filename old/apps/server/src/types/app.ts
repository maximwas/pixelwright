import type { McpServer } from "@modelcontextprotocol/server";
import type { PluginBridge } from "../bridge/plugin-bridge.ts";
import type { Logger } from "./logging.ts";

export interface App {
  readonly server: McpServer;
  readonly bridge: PluginBridge;
  readonly logger: Logger;
  close(): Promise<void>;
}
