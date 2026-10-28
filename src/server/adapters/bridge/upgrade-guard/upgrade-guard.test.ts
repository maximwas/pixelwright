import type { IncomingHttpHeaders } from "node:http";
import { describe, expect, it } from "vitest";
import { UpgradeGuard } from "@/server/adapters/bridge/upgrade-guard/upgrade-guard.ts";

const PORT = 18_721;

const guard = new UpgradeGuard({
  port: PORT,
  pluginOrigins: ["https://extra.example"],
  configFile: "unused",
});

const check = (
  url: string,
  headers: IncomingHttpHeaders,
) =>
  guard.check(
    {
      url,
      headers,
    },
    PORT,
  );

const PLUGIN = "/pixelwright/v1";

const PEER = "/pixelwright/v1/peer";

describe("UpgradeGuard", () => {
  it("lets the plugin's window in: this server's Host and Origin null", () => {
    expect(
      check(PLUGIN, {
        host: `127.0.0.1:${PORT}`,
        origin: "null",
      }),
    ).toEqual({
      status: 101,
      role: "plugin",
    });
    expect(
      check(`${PLUGIN}?v=1`, {
        host: `LOCALHOST:${PORT}`,
        origin: "null",
      }),
    ).toMatchObject({ status: 101 });
  });

  it("lets in an origin the settings add (PIXELWRIGHT_PLUGIN_ORIGINS)", () => {
    expect(
      check(PLUGIN, {
        host: `localhost:${PORT}`,
        origin: "https://extra.example",
      }),
    ).toMatchObject({
      status: 101,
    });
  });

  it("answers 404 for any other path", () => {
    expect(
      check("/", {
        host: `127.0.0.1:${PORT}`,
        origin: "null",
      }),
    ).toEqual({ status: 404 });
    expect(
      check("/pixelwright/v2", {
        host: `127.0.0.1:${PORT}`,
        origin: "null",
      }),
    ).toEqual({ status: 404 });
  });

  it.each([
    ["another host", "example.com"],
    ["this host on another port", "127.0.0.1:18720"],
    ["no port", "127.0.0.1"],
    ["no Host at all", undefined],
  ])("refuses %s with 403 host: a DNS-rebinding page names its own", (_case, host) => {
    expect(
      check(PLUGIN, {
        host,
        origin: "null",
      }),
    ).toEqual({
      status: 403,
      role: "plugin",
      rejection: {
        reason: "host",
        origin: "null",
      },
    });
  });

  it.each([
    ["a web page's origin", "https://evil.example"],
    ["no Origin", undefined],
  ])("refuses the plugin path with %s: 403 origin", (_case, origin) => {
    expect(
      check(PLUGIN, {
        host: `127.0.0.1:${PORT}`,
        origin,
      }),
    ).toEqual({
      status: 403,
      role: "plugin",
      rejection: {
        reason: "origin",
        origin: origin ?? null,
      },
    });
  });

  it("lets a peer in without an Origin, and refuses one that sends any, even null: a browser always sends one", () => {
    expect(check(PEER, { host: `127.0.0.1:${PORT}` })).toEqual({
      status: 101,
      role: "peer",
    });
    expect(
      check(PEER, {
        host: `127.0.0.1:${PORT}`,
        origin: "null",
      }),
    ).toEqual({
      status: 403,
      role: "peer",
      rejection: {
        reason: "origin",
        origin: "null",
      },
    });
    expect(check(PEER, { host: "example.com" })).toMatchObject({
      status: 403,
      rejection: { reason: "host" },
    });
  });
});
