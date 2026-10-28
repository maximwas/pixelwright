import { describe, expect, it } from "vitest";
import { ConfigReader } from "./config-reader.ts";

const HOME = "/home/someone";

describe("ConfigReader", () => {
  it("defaults to the dev channel's home and port, level info, the bridge on and no extra origins", () => {
    expect(new ConfigReader({}, HOME).read()).toEqual({
      home: "/home/someone/.pixelwright-new",
      logLevel: "info",
      pluginBridge: true,
      bridgePort: 18_721,
      pluginOrigins: [],
    });
  });

  it("takes PIXELWRIGHT_HOME, PIXELWRIGHT_LOG_LEVEL, PIXELWRIGHT_PLUGIN_BRIDGE=off and PIXELWRIGHT_PLUGIN_ORIGINS", () => {
    const env = {
      PIXELWRIGHT_HOME: "/tmp/pw",
      PIXELWRIGHT_LOG_LEVEL: "debug",
      PIXELWRIGHT_PLUGIN_BRIDGE: "off",
      PIXELWRIGHT_PLUGIN_ORIGINS: " https://one.example, ,https://two.example ",
    };

    expect(new ConfigReader(env, HOME).read()).toEqual({
      home: "/tmp/pw",
      logLevel: "debug",
      pluginBridge: false,
      bridgePort: 18_721,
      pluginOrigins: ["https://one.example", "https://two.example"],
    });
  });

  it("keeps the channel's port whatever the environment says: the plugin's manifest allows that one only", () => {
    expect(new ConfigReader({ PIXELWRIGHT_BRIDGE_PORT: "18720" }, HOME).read().bridgePort).toBe(18_721);
  });

  it("falls back to the default for an unknown level or an empty home", () => {
    const env = {
      PIXELWRIGHT_HOME: " ",
      PIXELWRIGHT_LOG_LEVEL: "loud",
    };

    expect(new ConfigReader(env, HOME).read()).toMatchObject({
      home: "/home/someone/.pixelwright-new",
      logLevel: "info",
    });
  });
});
