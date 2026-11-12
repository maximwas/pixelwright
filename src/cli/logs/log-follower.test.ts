import { appendFileSync, mkdtempSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LogFollower } from "@/cli/logs/log-follower.ts";

const line = (msg: string) => `${JSON.stringify({ level: 30, time: 0, pid: 7, msg })}\n`;
const WAIT = { timeout: 3_000 };

describe("LogFollower", () => {
  it("prints the last lines, then every line a server appends, across the .1 hand-over (S-065, B-062)", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "pixelwright-logs-")), "pixelwright.log");
    const written = { stdout: "" };
    const stdout = { isTTY: false, write: (text: string) => (written.stdout += text) };
    const stop = new AbortController();

    writeFileSync(file, line("before"));

    const following = new LogFollower({ file }, { stdin: {}, stdout, stderr: stdout }).follow(stop.signal);

    await vi.waitFor(() => expect(written.stdout).toContain("following"), WAIT);
    appendFileSync(file, line("appended"));
    await vi.waitFor(() => expect(written.stdout).toContain("appended"), WAIT);
    // A server sets the file aside past 5 MiB: its last lines are read from .1 first, then the new file.
    appendFileSync(file, line("last of the old file"));
    renameSync(file, `${file}.1`);
    writeFileSync(file, line("first of the new file"));
    await vi.waitFor(() => expect(written.stdout).toContain("first of the new file"), WAIT);
    stop.abort();
    await following;

    expect(written.stdout).toContain("before");
    expect(written.stdout.indexOf("last of the old file")).toBeGreaterThan(-1);
    expect(written.stdout.indexOf("last of the old file")).toBeLessThan(
      written.stdout.indexOf("first of the new file"),
    );
  });
});
