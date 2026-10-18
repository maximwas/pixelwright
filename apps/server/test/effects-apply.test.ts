import { describe, expect, it } from "vitest";
import { applyEffects } from "../src/features/effects-apply/apply-effects.ts";
import { effectsOf } from "../src/features/effects-apply/resolve-effects.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

describe("effects_apply: what the plugin is asked to write", () => {
  it("makes a preset into Figma's effect, its colours as Figma's channels", () => {
    expect(
      effectsOf({
        nodes: ["1:1"],
        preset: "grain",
        remove: [],
      }),
    ).toEqual({
      noise: {
        noiseType: "MONOTONE",
        noiseSize: 1,
        density: 0.55,
        color: {
          r: 0,
          g: 0,
          b: 0,
          a: 0.22,
        },
      },
      remove: [],
    });
  });

  it("lets the call change any value of a preset, the rest kept", () => {
    const { noise } = effectsOf({
      nodes: ["1:1"],
      preset: "film",
      noise: { density: 0.9 },
      remove: [],
    });

    expect(noise).toMatchObject({
      noiseType: "DUOTONE",
      density: 0.9,
      secondaryColor: {
        r: 1,
        g: 1,
        b: 1,
        a: 0.25,
      },
    });
  });

  it("takes its own values without a preset, defaults for the ones it leaves out", () => {
    const { glass, noise } = effectsOf({
      nodes: ["1:1"],
      glass: { blur: 20 },
      noise: {
        type: "multi",
        color: "#3B2FD9",
      },
      remove: [],
    });

    expect(glass).toEqual({
      lightIntensity: 0.5,
      lightAngle: -45,
      refraction: 0.3,
      depth: 12,
      dispersion: 0.1,
      radius: 20,
    });
    expect(noise).toMatchObject({
      noiseType: "MULTITONE",
      opacity: 0.3,
      color: {
        r: 59 / 255,
        g: 47 / 255,
        b: 217 / 255,
        a: 1,
      },
    });
  });

  it("refuses a colour it cannot read and a call that asks for nothing, saying what to give", () => {
    expect(() =>
      effectsOf({
        nodes: ["1:1"],
        noise: { color: "brandish" },
        remove: [],
      }),
    ).toThrow(/noise\.color "brandish" is not a CSS colour/);
    expect(() =>
      effectsOf({
        nodes: ["1:1"],
        remove: [],
      }),
    ).toThrow(/a preset, noise, texture, glass or remove/);
  });
});

/** A plugin answering the effects operation (changing the layers unless `changes` is false) and saving versions. */
function bridgeOf({ changes = true }: { changes?: boolean } = {}) {
  const asked: string[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (op, input) => {
      asked.push((input as { dryRun?: boolean }).dryRun ? `${op} (dry run)` : op);

      return op === "save_version"
        ? { id: "v-1" }
        : {
            changed: changes ? (input as { nodes: string[] }).nodes : [],
            errors: [],
          };
    },
  };

  return {
    asked,
    plugin: new PluginClient(bridge),
  };
}

describe("effects_apply: the version before the write", () => {
  it("saves a named version before a write that changes layers, after a dry run says it will", async () => {
    const { asked, plugin } = bridgeOf();
    const result = await applyEffects(plugin, {
      nodes: ["1:1"],
      preset: "grain",
      remove: [],
      dryRun: false,
      version: "Before the grain",
    });

    expect(asked).toEqual(["effects (dry run)", "save_version", "effects"]);
    expect(result).toMatchObject({
      changed: ["1:1"],
      dryRun: false,
      version: { id: "v-1" },
    });
  });

  it("saves none when nothing would change, nor in a dry run", async () => {
    const quiet = bridgeOf({ changes: false });

    await applyEffects(quiet.plugin, {
      nodes: ["1:1"],
      preset: "grain",
      remove: [],
      dryRun: false,
      version: "x",
    });
    expect(quiet.asked).toEqual(["effects (dry run)"]);

    const dry = bridgeOf();

    await applyEffects(dry.plugin, {
      nodes: ["1:1"],
      preset: "grain",
      remove: [],
      dryRun: true,
      version: "x",
    });
    expect(dry.asked).toEqual(["effects (dry run)"]);
  });
});
