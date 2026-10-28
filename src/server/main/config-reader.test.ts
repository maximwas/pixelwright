import { describe, expect, it } from "vitest";
import { ConfigReader } from "./config-reader.ts";

const HOME = "/home/someone";

describe("ConfigReader", () => {
  it("defaults to the dev channel's home, level info and the bridge on", () => {
    expect(new ConfigReader({}, HOME).read()).toEqual({
      home: "/home/someone/.pixelwright-new",
      logLevel: "info",
      pluginBridge: true,
    });
  });

  it("takes PIXELWRIGHT_HOME, PIXELWRIGHT_LOG_LEVEL and PIXELWRIGHT_PLUGIN_BRIDGE=off", () => {
    const env = {
      PIXELWRIGHT_HOME: "/tmp/pw",
      PIXELWRIGHT_LOG_LEVEL: "debug",
      PIXELWRIGHT_PLUGIN_BRIDGE: "off",
    };

    expect(new ConfigReader(env, HOME).read()).toEqual({
      home: "/tmp/pw",
      logLevel: "debug",
      pluginBridge: false,
    });
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
