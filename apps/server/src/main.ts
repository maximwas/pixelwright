import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createApp } from "./app.ts";
import { guardStdout } from "./logging/stdout-guard.ts";
import { ToolCallLog } from "./logging/tool-call-log.ts";

/** Runs the MCP server on stdio until the client goes away or the process is told to stop. */
export async function startMcp(): Promise<void> {
  guardStdout();

  const app = await createApp();
  let closing = false;

  const shutdown = async (reason: string): Promise<void> => {
    if (closing) {
      return;
    }

    closing = true;
    app.logger.info({ reason }, "Shutting down");
    await app.close();
    process.exit(0);
  };

  process.stdin.on("end", () => void shutdown("stdin end"));
  process.stdin.on("close", () => void shutdown("stdin close"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.server.connect(new ToolCallLog(new StdioServerTransport(), app.logger));
  app.logger.info({ bridge: app.bridge.status().role }, "pixelwright ready on stdio");
}
