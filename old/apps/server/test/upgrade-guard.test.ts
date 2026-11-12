import { BRIDGE_PATH } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { checkUpgrade } from "../src/bridge/upgrade-guard.ts";

const policy = {
  allowedHosts: new Set(["127.0.0.1:18720", "localhost:18720"]),
  pluginOrigins: new Set(["null"]),
};

describe("checkUpgrade", () => {
  it("lets the plugin in from an allowed origin on the server's own host", () => {
    expect(
      checkUpgrade(
        {
          url: BRIDGE_PATH,
          headers: {
            host: "localhost:18720",
            origin: "null",
          },
        },
        policy,
      ),
    ).toEqual({
      status: 101,
      role: "plugin",
    });
  });

  it("refuses another origin, no origin and a foreign host", () => {
    const evil = {
      host: "localhost:18720",
      origin: "https://evil.example",
    };

    expect(
      checkUpgrade(
        {
          url: BRIDGE_PATH,
          headers: evil,
        },
        policy,
      ),
    ).toMatchObject({
      status: 403,
      rejection: {
        reason: "origin",
        origin: "https://evil.example",
      },
    });
    expect(
      checkUpgrade(
        {
          url: BRIDGE_PATH,
          headers: { host: "localhost:18720" },
        },
        policy,
      ),
    ).toMatchObject({
      status: 403,
      rejection: { reason: "origin" },
    });
    expect(
      checkUpgrade(
        {
          url: BRIDGE_PATH,
          headers: {
            host: "evil.example:18720",
            origin: "null",
          },
        },
        policy,
      ),
    ).toMatchObject({
      status: 403,
      rejection: { reason: "host" },
    });
  });

  it("answers 404 on another path", () => {
    expect(
      checkUpgrade(
        {
          url: "/other",
          headers: {
            host: "localhost:18720",
            origin: "null",
          },
        },
        policy,
      ),
    ).toEqual({
      status: 404,
    });
  });

  it("lets another pixelwright process in on the peer path with no Origin, and refuses a page there", () => {
    expect(
      checkUpgrade(
        {
          url: `${BRIDGE_PATH}/peer`,
          headers: { host: "127.0.0.1:18720" },
        },
        policy,
      ),
    ).toEqual({
      status: 101,
      role: "peer",
    });
    expect(
      checkUpgrade(
        {
          url: `${BRIDGE_PATH}/peer`,
          headers: {
            host: "127.0.0.1:18720",
            origin: "null",
          },
        },
        policy,
      ),
    ).toMatchObject({
      status: 403,
      rejection: { reason: "origin" },
    });
  });
});
