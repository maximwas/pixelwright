import { ServerMain } from "@/server/main/server.main.ts";

/** The pixelwright binary's root: with no command it serves MCP on stdio; setup, logs and the Node gate come in item 69. */
export class CliMain {
  async run(): Promise<void> {
    await new ServerMain().start();
  }
}
