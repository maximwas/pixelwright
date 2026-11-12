import { describe, expect, it } from "vitest";
import { ConfigReader } from "@/server/main/config/config-reader.ts";
import { CHANNEL } from "@/shared/protocol/channel.constants.ts";

const HOME = "/home/someone";

describe("ConfigReader", () => {
  it("defaults to the build channel's home and port, level info, the bridge on and no extra origins", () => {
    expect(new ConfigReader({}, HOME).read()).toEqual({
      home: `/home/someone/${CHANNEL.home}`,
      logLevel: "info",
      pluginBridge: true,
      bridgePort: CHANNEL.port,
      pluginOrigins: [],
      projectDir: process.cwd(),
      updateCheck: true,
    });
  });

  it("takes PIXELWRIGHT_HOME, _LOG_LEVEL, _PLUGIN_BRIDGE=off, _PLUGIN_ORIGINS, _NO_UPDATE_CHECK and CLAUDE_PROJECT_DIR (T-008, S-070)", () => {
    const env = {
      PIXELWRIGHT_HOME: "/tmp/pw",
      PIXELWRIGHT_LOG_LEVEL: "debug",
      PIXELWRIGHT_PLUGIN_BRIDGE: "off",
      PIXELWRIGHT_PLUGIN_ORIGINS: " https://one.example, ,https://two.example ",
      PIXELWRIGHT_NO_UPDATE_CHECK: "1",
      CLAUDE_PROJECT_DIR: "/work/app",
    };

    expect(new ConfigReader(env, HOME).read()).toEqual({
      home: "/tmp/pw",
      logLevel: "debug",
      pluginBridge: false,
      bridgePort: CHANNEL.port,
      pluginOrigins: ["https://one.example", "https://two.example"],
      projectDir: "/work/app",
      updateCheck: false,
    });
  });

  it("keeps the channel's port whatever the environment says: the plugin's manifest allows that one only", () => {
    expect(new ConfigReader({ PIXELWRIGHT_BRIDGE_PORT: String(CHANNEL.port + 1) }, HOME).read().bridgePort).toBe(
      CHANNEL.port,
    );
  });

  it("falls back to the default for an unknown level or an empty home", () => {
    const env = { PIXELWRIGHT_HOME: " ", PIXELWRIGHT_LOG_LEVEL: "loud" };

    expect(new ConfigReader(env, HOME).read()).toMatchObject({
      home: `/home/someone/${CHANNEL.home}`,
      logLevel: "info",
    });
  });
});
