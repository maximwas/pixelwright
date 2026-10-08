import { BridgeError } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { readStatus } from "../src/mcp/tools/status.ts";
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
          name: "Positivus",
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
      port: 18_720,
    });
    expect(status.files).toEqual([
      {
        session: "s1",
        name: "Positivus",
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
});
