import { appendFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readConfig } from "../src/config/config.ts";
import { followLog } from "../src/logging/follow-log.ts";
import { prepareLogFile } from "../src/logging/log-file.ts";
import { prettyLine } from "../src/logging/pretty-line.ts";

const record = (fields: Record<string, unknown>) =>
  JSON.stringify({
    level: 30,
    time: new Date(2026, 9, 14, 13, 22, 44).getTime(),
    pid: 58063,
    hostname: "mac",
    name: "pixelwright",
    ...fields,
  });

describe("pixelwright logs", () => {
  it("prints a log line for people: time, level, process, message and its fields", () => {
    expect(
      prettyLine(
        record({
          msg: "tool design_read",
          file: "Test MCP",
          ms: 31,
        }),
      ),
    ).toBe("13:22:44 info  [58063] tool design_read  file=Test MCP ms=31");
    expect(
      prettyLine(
        record({
          level: 40,
          msg: "tool design_apply failed",
          err: { message: "Allow edits is off" },
        }),
      ),
    ).toContain("warn  [58063] tool design_apply failed  error=Allow edits is off");
    expect(prettyLine("not json")).toBe("not json");
  });

  it("keeps the shared log in the Pixelwright folder, and sets a full one aside", () => {
    const home = mkdtempSync(join(tmpdir(), "pw-logs-"));
    const file = readConfig({ PIXELWRIGHT_HOME: home }).logFile;

    expect(file).toBe(join(home, "logs", "pixelwright.log"));
    expect(prepareLogFile(file)).toBe(true);

    writeFileSync(file, "x".repeat(6 * 1024 * 1024));
    expect(prepareLogFile(file)).toBe(true);
    expect(existsSync(`${file}.1`)).toBe(true);
    expect(existsSync(file)).toBe(false);
  });

  it("prints the log's last lines, then what any server writes after, until stopped", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "pw-follow-")), "pixelwright.log");
    const printed: string[] = [];
    const stop = new AbortController();

    writeFileSync(file, `${record({ msg: "pixelwright ready on stdio" })}\n`);

    const following = followLog(file, (line) => printed.push(line), stop.signal);

    await new Promise((resolve) => setTimeout(resolve, 100));
    appendFileSync(
      file,
      `${record({
        msg: "tool outline",
        ms: 4,
      })}\n`,
    );

    for (const until = Date.now() + 3_000; !printed.some((line) => line.includes("tool outline")); ) {
      if (Date.now() > until) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    stop.abort();
    await following;

    expect(printed[0]).toContain("pixelwright ready on stdio");
    expect(printed.some((line) => line.includes("following"))).toBe(true);
    expect(printed.at(-1)).toContain("tool outline  ms=4");
    expect(readFileSync(file, "utf8")).toContain("tool outline");
  });
});
