import * as fs from "node:fs";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LOG_FILE_MAX_BYTES } from "../src/constants/logging.ts";
import { SharedLog } from "../src/logging/shared-log.ts";

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();

  return {
    ...real,
    renameSync: vi.fn(real.renameSync),
  };
});

const logIn = () => join(mkdtempSync(join(tmpdir(), "pw-shared-log-")), "logs", "pixelwright.log");

describe("SharedLog", () => {
  it("keeps logging into a full file it cannot set aside, without trying again on every line", () => {
    const path = logIn();
    const log = SharedLog.open(path);

    // The set-aside name is taken by a folder that cannot be replaced: renaming onto it fails.
    mkdirSync(`${path}.1`);
    writeFileSync(join(`${path}.1`, "keep"), "");
    writeFileSync(path, "x".repeat(LOG_FILE_MAX_BYTES + 1));
    vi.mocked(fs.renameSync).mockClear();

    log?.write("one\n");
    log?.write("two\n");
    log?.write("three\n");

    expect(readFileSync(path, "utf8").endsWith("one\ntwo\nthree\n")).toBe(true);
    expect(vi.mocked(fs.renameSync)).toHaveBeenCalledTimes(1);
  });

  it("makes its folder again when it was deleted while the server runs", () => {
    const path = logIn();
    const log = SharedLog.open(path);

    log?.write("before\n");
    rmSync(join(path, ".."), { recursive: true });
    log?.write("after\n");

    expect(readFileSync(path, "utf8")).toBe("after\n");
  });
});
