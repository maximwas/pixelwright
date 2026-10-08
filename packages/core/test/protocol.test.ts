import { describe, expect, it } from "vitest";
import {
  BRIDGE_PROTOCOL_VERSION,
  BridgeError,
  decodePluginToServer,
  decodeServerToPlugin,
  encode,
  fromWireError,
  type PluginInfo,
  toWireError,
} from "../src/index.ts";

const info: PluginInfo = {
  instanceId: "window-a",
  pluginVersion: "0.1.0",
  editorType: "figma",
  file: {
    name: "Untitled",
    key: null,
  },
  page: {
    id: "0:1",
    name: "Page 1",
  },
  allowEdits: false,
  visible: true,
};

describe("bridge protocol", () => {
  it("decodes a plugin's hello and its info event", () => {
    const hello = encode({
      type: "hello",
      protocol: BRIDGE_PROTOCOL_VERSION,
      plugin: info,
    });

    expect(decodePluginToServer(hello)).toEqual({
      type: "hello",
      protocol: 1,
      plugin: info,
    });
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "event",
          name: "plugin.info",
          data: info,
        }),
      )?.type,
    ).toBe("event");
  });

  it("refuses what is not a protocol message", () => {
    expect(decodePluginToServer("not json")).toBeNull();
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "hello",
          protocol: 1,
          plugin: {
            ...info,
            file: null,
          },
        }),
      ),
    ).toBeNull();
    // The server never receives a request, and never sends a response.
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "request",
          id: "1",
          op: "ping",
          timeoutMs: 1,
        }),
      ),
    ).toBeNull();
    expect(
      decodeServerToPlugin(
        JSON.stringify({
          type: "response",
          id: "1",
          ok: true,
        }),
      ),
    ).toBeNull();
  });

  it("refuses plugin info with strings longer than a real file, page or plugin ever has", () => {
    const hello = (overrides: Partial<PluginInfo>) =>
      JSON.stringify({
        type: "hello",
        protocol: 1,
        plugin: {
          ...info,
          ...overrides,
        },
      });

    expect(
      decodePluginToServer(
        hello({
          file: {
            name: "x".repeat(10_000),
            key: null,
          },
        }),
      ),
    ).toBeNull();
    expect(decodePluginToServer(hello({ instanceId: "x".repeat(1_000) }))).toBeNull();
    expect(
      decodePluginToServer(
        hello({
          file: {
            name: "x".repeat(1_000),
            key: null,
          },
        }),
      )?.type,
    ).toBe("hello");
  });

  it("carries errors across the bridge", () => {
    expect(toWireError(new BridgeError("TIMEOUT", "ping timed out"))).toEqual({
      code: "TIMEOUT",
      message: "ping timed out",
      data: null,
    });
    expect(toWireError(new Error("boom"))).toEqual({
      code: "OP_FAILED",
      message: "boom",
    });

    const restored = fromWireError({
      code: "UNKNOWN_OP",
      message: "Unknown operation: x",
    });

    expect(restored).toBeInstanceOf(BridgeError);
    expect(restored.code).toBe("UNKNOWN_OP");
  });
});
