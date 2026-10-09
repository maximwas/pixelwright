import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FilePluginKeys } from "../src/bridge/plugin-keys.ts";

const config = {
  version: 1 as const,
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

  it("treats a deleted or broken bridge.json as no keys, without throwing", async () => {
    const deleted = await file();

    await rm(deleted);
    expect(new FilePluginKeys(deleted).find("0123456789abcdef")).toBeNull();

    const broken = await file();

    await writeFile(broken, '{"version": 1, "port": 18720, "token": "t', { mode: 0o600 });
    expect(new FilePluginKeys(broken).find("0123456789abcdef")).toBeNull();
  });

  it("leaves no copy of the keys behind when the write fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pixelwright-keys-"));

    // A folder where bridge.json should be: the key is written aside, then cannot replace it.
    await mkdir(join(dir, "bridge.json"));

    expect(() =>
      new FilePluginKeys(join(dir, "bridge.json"), () => ({
        ...config,
        pluginKeys: [],
      })).add(),
    ).toThrow();
    expect(await readdir(dir)).toEqual(["bridge.json"]);
  });

  it("rebuilds a deleted bridge.json from the running config when it adds a key", async () => {
    const path = await file();

    await rm(path);

    const key = new FilePluginKeys(path, () => ({
      ...config,
      pluginKeys: [],
    })).add();

    expect(new FilePluginKeys(path).find(key.id)).toEqual(key);
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject(config);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
