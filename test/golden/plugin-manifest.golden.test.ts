import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PluginManifest } from "@/plugin/main/plugin-manifest.ts";
import { CHANNELS } from "@/shared/protocol/channel.constants.ts";

/** 0.7.0's manifest.json as its build wrote it, byte for byte (pixelwright-old apps/plugin, the installed plugin). */
const OLD = JSON.parse(readFileSync(new URL("fixtures/manifest-0.7.0.json", import.meta.url), "utf8"));

/** Where the built files sit: dist/plugin's names, not create-figma-plugin's build/ folder. */
const BUILD_FIELDS = ["main", "ui"];

/** The fields whose values differ between two manifests, nested ones as paths. */
const differing = (
  left: unknown,
  right: unknown,
  path = "",
): string[] => {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return JSON.stringify(left) === JSON.stringify(right) ? [] : [path];
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...keys].flatMap((key) =>
    differing(Reflect.get(left, key), Reflect.get(right, key), path === "" ? key : `${path}.${key}`),
  );
};

describe("PluginManifest", () => {
  it("writes 0.7.0's manifest.json for the release channel, fields in its order, apart from the build fields", () => {
    const release = new PluginManifest(CHANNELS.release).json();

    expect(Object.keys(release)).toEqual(Object.keys(OLD));
    expect(differing(release, OLD)).toEqual(BUILD_FIELDS);
    expect(release).toMatchObject({ main: "main.js", ui: "ui.html" });
  });

  it("differs for the dev channel only in its name, its id and its port", () => {
    const dev = new PluginManifest(CHANNELS.dev).json();

    expect(differing(dev, new PluginManifest(CHANNELS.release).json())).toEqual([
      "id",
      "name",
      "networkAccess.allowedDomains.0",
    ]);
    expect(dev).toMatchObject({
      id: "pixelwright-new",
      name: "Pixelwright New",
      networkAccess: { allowedDomains: ["ws://localhost:18721"] },
    });
  });
});
