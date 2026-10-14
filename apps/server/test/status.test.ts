import { BridgeError } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { readStatus } from "../src/features/status/read-status.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const view = (request: BridgeView["request"]): BridgeView => ({
  status: () => ({
    role: "owner",
    port: 18_720,
    hint: null,
  }),
  plugins: () => [
    {
      session: "s1",
      info: pluginInfo({
        file: {
          name: "Orbit",
          key: null,
        },
      }),
      active: true,
    },
    {
      session: "s2",
      info: pluginInfo({
        instanceId: "b",
        file: {
          name: "Kit",
          key: "abc",
        },
        allowEdits: true,
      }),
      active: false,
    },
  ],
  request,
  pairing: () => null,
});

describe("status", () => {
  it("lists the connected files and pings the active one", async () => {
    const status = await readStatus(
      view(async () => ({ pong: true })),
      "0.1.0",
      true,
    );

    expect(status.server).toEqual({
      version: "0.1.0",
      role: "owner",
      protocol: 5,
      port: 18_720,
    });
    expect(status.files).toEqual([
      {
        session: "s1",
        name: "Orbit",
        key: null,
        page: "Page 1",
        editorType: "figma",
        allowEdits: false,
        active: true,
        pluginVersion: "0.1.0",
      },
      {
        session: "s2",
        name: "Kit",
        key: "abc",
        page: "Page 1",
        editorType: "figma",
        allowEdits: true,
        active: false,
        pluginVersion: "0.1.0",
      },
    ]);
    expect(status.probe).toMatchObject({
      ok: true,
      error: null,
    });
  });

  it("reports a failed ping instead of failing", async () => {
    const failing = view(async () => {
      throw new BridgeError("TIMEOUT", "ping timed out after 30000 ms");
    });
    const status = await readStatus(failing, "0.1.0", true);

    expect(status.probe).toEqual({
      ok: false,
      ms: null,
      error: expect.stringContaining("timed out"),
    });
  });

  it("does not ping unless asked", async () => {
    const status = await readStatus(
      view(async () => ({ pong: true })),
      "0.1.0",
      false,
    );

    expect(status.probe).toBeNull();
  });

  it("shows the pairing code with the seconds it has left", async () => {
    const waiting: BridgeView = {
      ...view(async () => ({ pong: true })),
      pairing: () => ({
        code: "123456",
        expiresAt: Date.now() + 90_000,
        lockedUntil: null,
        waiting: 1,
      }),
    };
    const status = await readStatus(waiting, "0.1.0", false);

    expect(status.pairing).toEqual({
      code: "123456",
      expiresInSeconds: 90,
      lockedForSeconds: null,
      waiting: 1,
    });
  });

  it("says when pairing is locked, with no code", async () => {
    const locked: BridgeView = {
      ...view(async () => ({ pong: true })),
      pairing: () => ({
        code: null,
        expiresAt: null,
        lockedUntil: Date.now() + 30_000,
        waiting: 1,
      }),
    };
    const status = await readStatus(locked, "0.1.0", false);

    expect(status.pairing).toEqual({
      code: null,
      expiresInSeconds: null,
      lockedForSeconds: 30,
      waiting: 1,
    });
  });
});
