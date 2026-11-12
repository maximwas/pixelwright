import { chmodSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { AtomicJsonFile } from "@/server/adapters/files/atomic-json-file.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger.ts";

const Schema = zod.object({ version: zod.literal(1), token: zod.string().check(zod.minLength(8)) });

const FALLBACK = { version: 1, token: "fallback" } as const;

const SECRET = "tok-4711-very-secret";

/** An AtomicJsonFile over a temp folder, with every log line it writes. */
class FileProbe {
  readonly lines: Record<string, unknown>[] = [];
  readonly folder = join(mkdtempSync(join(tmpdir(), "pixelwright-json-")), "home");
  readonly path = join(this.folder, "bridge.json");
  readonly files = new AtomicJsonFile(
    new PinoLogger({ level: "info", file: "unused" }, [{ write: (line: string) => this.lines.push(JSON.parse(line)) }]),
  );

  read(): zod.output<typeof Schema> {
    return this.files.read(this.path, Schema, FALLBACK);
  }

  mode(path = this.path): string {
    return (statSync(path).mode & 0o777).toString(8);
  }
}

describe("AtomicJsonFile", () => {
  it("reads a missing file as the fallback, without a word", () => {
    const probe = new FileProbe();

    expect(probe.read()).toEqual(FALLBACK);
    expect(probe.lines).toEqual([]);
  });

  it("reads a file that is not JSON as the fallback and never logs its content", () => {
    const probe = new FileProbe();

    probe.files.write(probe.path, {});
    writeFileSync(probe.path, `{"version":1,"token":"${SECRET}"`);

    expect(probe.read()).toEqual(FALLBACK);
    expect(probe.lines).toMatchObject([{ level: 40, reason: "not JSON", file: probe.path }]);
    expect(JSON.stringify(probe.lines)).not.toContain(SECRET);
  });

  it("names the schema's issues for a file off the schema, never the values", () => {
    const probe = new FileProbe();

    probe.files.write(probe.path, { version: 2, token: "short" });

    expect(probe.read()).toEqual(FALLBACK);
    expect(probe.lines).toMatchObject([
      {
        level: 40,
        issues: ["version: Invalid input: expected 1", expect.stringMatching(/^token: Too small: expected string/)],
      },
    ]);
    expect(JSON.stringify(probe.lines)).not.toContain("short");
  });

  it("writes a file only the user can read, in a folder only the user can open, and reads it back", () => {
    const probe = new FileProbe();
    const value = { version: 1, token: SECRET };

    probe.files.write(probe.path, value);

    expect(probe.mode()).toBe("600");
    expect(probe.mode(probe.folder)).toBe("700");
    expect(probe.read()).toEqual(value);
  });

  it("makes a file private again when it is rewritten", () => {
    const probe = new FileProbe();

    probe.files.write(probe.path, FALLBACK);
    chmodSync(probe.path, 0o644);
    probe.files.write(probe.path, FALLBACK);

    expect(probe.mode()).toBe("600");
  });

  it("ensures a file: created when absent, kept as it is when present, made private, no temp file left", () => {
    const probe = new FileProbe();

    probe.files.ensure(probe.path, FALLBACK);
    expect(probe.read()).toEqual(FALLBACK);
    expect(probe.mode()).toBe("600");

    writeFileSync(probe.path, "not even JSON");
    chmodSync(probe.path, 0o644);
    probe.files.ensure(probe.path, FALLBACK);

    expect(readFileSync(probe.path, "utf8")).toBe("not even JSON");
    expect(probe.mode()).toBe("600");
    expect(readdirSync(probe.folder)).toEqual(["bridge.json"]);
  });

  it("logs a file that cannot be written with its code, and throws", () => {
    const probe = new FileProbe();
    const blocked = join(probe.path, "inside-a-file.json");

    probe.files.write(probe.path, FALLBACK);

    // Its folder would be bridge.json, a file: mkdir refuses with EEXIST.
    expect(() => probe.files.write(blocked, FALLBACK)).toThrow();
    expect(probe.lines).toMatchObject([{ level: 40, file: blocked, reason: "EEXIST" }]);
  });
});
