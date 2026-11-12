import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginCopy } from "@/cli/setup/plugin-copy.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

/** A built plugin as the package carries it: the manifest naming this channel's plugin, main and the window. */
function fakePlugin(): string {
  const from = mkdtempSync(join(tmpdir(), "pixelwright-plugin-src-"));

  writeFileSync(join(from, "manifest.json"), JSON.stringify({ name: CHANNEL.pluginName }));
  writeFileSync(join(from, "main.js"), "main");
  writeFileSync(join(from, "ui.html"), "ui");

  return from;
}

const tempHome = () => mkdtempSync(join(tmpdir(), "pixelwright-home-"));

describe("PluginCopy", () => {
  it("copies the plugin where Figma Desktop can import the manifest from, replacing its own older copy (S-062)", async () => {
    const to = join(tempHome(), "plugin");

    mkdirSync(to, { recursive: true });
    writeFileSync(join(to, "manifest.json"), JSON.stringify({ name: CHANNEL.pluginName }));
    writeFileSync(join(to, "old.js"), "old");

    expect(await new PluginCopy().install(fakePlugin(), to)).toBe(join(to, "manifest.json"));
    expect(readdirSync(to).sort()).toEqual(["main.js", "manifest.json", "ui.html"]);
  });

  it("never replaces a folder that holds something else", async () => {
    const to = join(tempHome(), "plugin");

    mkdirSync(to);
    writeFileSync(join(to, "notes.txt"), "mine");

    await expect(new PluginCopy().install(fakePlugin(), to)).rejects.toThrow(
      new RegExp(`not a ${CHANNEL.pluginName} plugin folder`),
    );
    expect(readFileSync(join(to, "notes.txt"), "utf8")).toBe("mine");
  });

  it("puts it in a home only its owner can open: the home also keeps the pairing keys", async () => {
    const home = join(tempHome(), CHANNEL.home);

    await new PluginCopy().install(fakePlugin(), join(home, "plugin"));

    expect(statSync(home).mode & 0o777).toBe(0o700);
  });

  it("says what to do when the package has no plugin", async () => {
    await expect(new PluginCopy().install(tempHome(), join(tempHome(), "plugin"))).rejects.toThrow(/manifest\.json/);
  });
});
