import { describe, expect, it } from "vitest";
import { COMMAND } from "@/cli/main/cli.constants.ts";
import type { CliStreams } from "@/cli/main/cli.types.ts";
import { CommandLine } from "@/cli/main/command-line.ts";

/** Streams that keep what was written; `terminal` says whether a person sits at stdin and stdout. */
function streams(terminal: boolean) {
  const written = { stdout: "", stderr: "" };
  const value: CliStreams = {
    stdin: { isTTY: terminal },
    stdout: { isTTY: terminal, write: (text: string) => (written.stdout += text) },
    stderr: { isTTY: terminal, write: (text: string) => (written.stderr += text) },
  };

  return { written, value };
}

const parse = (args: string[], terminal = true) => new CommandLine([], streams(terminal).value).parse(args);

describe("CommandLine", () => {
  it("is the MCP server for a client, the setup for a person at a terminal (S-060)", () => {
    expect(parse([], false)).toBe(COMMAND.serve);
    expect(parse([])).toBe(COMMAND.setup);
    expect(parse(["serve"])).toBe(COMMAND.serve);
    expect(parse(["setup", "--print"])).toBe(COMMAND.setupPrint);
    expect(parse(["logs"], false)).toBe(COMMAND.logs);
    expect(parse(["--version"])).toBe(COMMAND.version);
    expect(parse(["-v"])).toBe(COMMAND.version);
    expect(parse(["version"])).toBe(COMMAND.version);
    expect(parse(["-h"])).toBe(COMMAND.help);
    expect(parse(["help"])).toBe(COMMAND.help);

    for (const unknown of [
      ["publish"],
      ["logs", "--all"],
      ["setup", "--force"],
      ["serve", "--print"],
      ["serve", "x"],
    ]) {
      expect(parse(unknown)).toBe(COMMAND.unknown);
    }
  });

  it("prints the setup instead of asking when nobody is at a terminal", () => {
    expect(parse(["setup"], false)).toBe(COMMAND.setupPrint);
  });

  it("says what it does not know on stderr, with the help, and exits 2", async () => {
    const { written, value } = streams(true);

    expect(await new CommandLine([], value).run(["publish"])).toBe(2);
    expect(written.stderr).toContain("Unknown command: publish");
    expect(written.stderr).toContain("setup --print");
    expect(written.stdout).toBe("");
  });
});
