import { inject, injectable } from "@needle-di/core";
import { CLI_TEXT, COMMAND, EXIT_CODE } from "@/cli/main/cli.constants.ts";
import { CLI_STREAMS } from "@/cli/main/cli.tokens.ts";
import type { CliCommand } from "@/cli/main/cli.types.ts";
import { ServerMain } from "@/server/main/server.main.ts";

/** `serve`, and no command for an MCP client: the server on stdio, which keeps its own container (A§4.2). */
@injectable()
export class ServeCommand implements CliCommand {
  readonly name = COMMAND.serve;
  readonly #streams;

  constructor(streams = inject(CLI_STREAMS)) {
    this.#streams = streams;
  }

  async run(): Promise<number> {
    // A person who started it by hand learns what it is; stderr, since stdout is MCP's (S-056).
    if (this.#streams.stdin.isTTY ?? false) {
      this.#streams.stderr.write(CLI_TEXT.startedInTerminal);
    }

    await new ServerMain().start();

    return EXIT_CODE.ok;
  }
}
