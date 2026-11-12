import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext, Script } from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";
import { PluginManifest } from "@/plugin/main/plugin-manifest.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";
import { VERSION } from "@/shared/version/version.constants.ts";
import { PluginBuild } from "./plugin-build.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT = mkdtempSync(join(tmpdir(), "pixelwright-plugin-"));
const built = (file: string) => readFileSync(join(OUT, file), "utf8");

/** The window's inline script, as Figma runs it. */
const SCRIPT = /<script>([\s\S]*)<\/script>/;

/** The globals Figma's main sandbox has (P1); nothing else. */
const SANDBOX = { console, setTimeout, clearTimeout, setInterval };

beforeAll(async () => {
  await new PluginBuild(ROOT, OUT).run(CHANNEL);
}, 30_000);

describe("the plugin build", () => {
  it("resolves every @/ import and the package's own package.json: main.js carries the version", () => {
    expect(built("main.js")).toContain(VERSION);
    expect(`${built("main.js")}${built("ui.html")}`).not.toMatch(/["']@\//);
  });

  it("writes the channel's manifest, and inlines the window's script into ui.html", () => {
    expect(JSON.parse(built("manifest.json"))).toEqual(new PluginManifest(CHANNEL).json());
    expect(built("ui.html")).not.toContain("/* ui.js */");
    expect(() => new Script(SCRIPT.exec(built("ui.html"))?.[1] ?? "")).not.toThrow();
  });

  it("runs main.js with only the sandbox's globals until its first Figma call: no missing global on the way", () => {
    expect(() => runInNewContext(built("main.js"), { ...SANDBOX })).toThrow(/^figma is not defined$/);
  });

  it("appends the notices of the packages each bundle holds", () => {
    expect(built("main.js")).toMatch(/## @needle-di\/core[\s\S]*## zod/);
    expect(built("ui.html")).toMatch(/## @needle-di\/core[\s\S]*## @noble\/hashes[\s\S]*## zod/);
  });
});
