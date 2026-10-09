import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FilePluginKeys } from "../src/bridge/plugin-keys.ts";

const config = {
  version: 1,
  port: 18_720,
  token: "t".repeat(43),
};

async function file() {
  const path = join(await mkdtemp(join(tmpdir(), "pixelwright-keys-")), "bridge.json");

  await writeFile(path, `${JSON.stringify(config)}\n`, { mode: 0o600 });

  return path;
}

describe("FilePluginKeys", () => {
  it("reads a stage-1 bridge.json without keys", async () => {
    expect(new FilePluginKeys(await file()).find("0123456789abcdef")).toBeNull();
  });

  it("adds a key that another process finds, keeping the file private and the rest of it", async () => {
    const path = await file();
    const key = new FilePluginKeys(path).add();

    expect(new FilePluginKeys(path).find(key.id)).toEqual(key);
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject(config);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
