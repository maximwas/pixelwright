import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BridgeConfig } from "@/server/adapters/bridge/listener/bridge-config.ts";
import { AtomicJsonFile } from "@/server/adapters/files/atomic-json-file.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger.ts";

const NOW = Date.parse("2026-10-28T12:00:00.000Z");

/** BridgeConfig built by hand over bridge.json in a temp home; config() is another process reading the same file. */
class ConfigProbe {
  readonly file = join(mkdtempSync(join(tmpdir(), "pixelwright-bridge-")), "bridge.json");
  readonly lines: Record<string, unknown>[] = [];
  readonly files = new AtomicJsonFile(
    new PinoLogger({ level: "info", file: "unused" }, [{ write: (line: string) => this.lines.push(JSON.parse(line)) }]),
  );

  config(): BridgeConfig {
    return new BridgeConfig(this.files, { port: 0, pluginOrigins: [], configFile: this.file }, { now: () => NOW });
  }

  json(): Record<string, unknown> {
    return JSON.parse(readFileSync(this.file, "utf8"));
  }

  mode(): string {
    return (statSync(this.file).mode & 0o777).toString(8);
  }
}

describe("BridgeConfig", () => {
  it("creates bridge.json v1 on the first start, private, with the channel's port, a token and no keys", () => {
    const probe = new ConfigProbe();

    probe.config().ensure();

    const first = probe.json();

    probe.config().ensure();

    expect(first).toEqual({ version: 1, port: 18_721, token: expect.stringMatching(/^[\w-]{43}$/), pluginKeys: [] });
    expect(probe.json()).toEqual(first);
    expect(probe.mode()).toBe("600");
  });

  it("stores a new key that another server finds, because every lookup reads the file", () => {
    const probe = new ConfigProbe();

    probe.config().ensure();

    const key = probe.config().addKey();

    expect(key).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{16}$/),
      secret: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(probe.config().findKey(key.id)).toEqual(key);
    expect(probe.config().findKey("0000000000000000")).toBeNull();
    expect(probe.json().pluginKeys).toEqual([{ ...key, createdAt: "2026-10-28T12:00:00.000Z" }]);
    expect(probe.mode()).toBe("600");
  });

  it("keeps every field on a rewrite, those a newer version wrote too", () => {
    const probe = new ConfigProbe();
    const newer = {
      version: 1,
      port: 18_721,
      token: "t".repeat(43),
      pluginKeys: [
        { id: "a".repeat(16), secret: "b".repeat(64), createdAt: "2026-10-01T00:00:00.000Z", label: "Studio Mac" },
      ],
      peers: { lastSeen: 3 },
    };

    writeFileSync(probe.file, JSON.stringify(newer));
    probe.config().addKey();

    expect(probe.json()).toMatchObject({
      ...newer,
      pluginKeys: [newer.pluginKeys[0], expect.objectContaining({ createdAt: "2026-10-28T12:00:00.000Z" })],
    });
  });

  it("reads a missing or broken file as no keys, never throwing, and writes a fresh one for a new key", () => {
    const probe = new ConfigProbe();

    expect(probe.config().findKey("a".repeat(16))).toBeNull();
    writeFileSync(probe.file, '{"version":1,"token":');
    expect(probe.config().findKey("a".repeat(16))).toBeNull();

    const key = probe.config().addKey();

    expect(probe.config().findKey(key.id)).toEqual(key);
    expect(probe.json()).toMatchObject({ version: 1, token: expect.stringMatching(/^[\w-]{43}$/) });
    expect(probe.lines).toMatchObject([{ reason: "not JSON" }, { reason: "not JSON" }]);
  });
});
