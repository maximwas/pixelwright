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
      keyId: null,
      nonce: "0".repeat(32),
    });

    expect(decodePluginToServer(hello)).toEqual({
      type: "hello",
      protocol: 2,
      plugin: info,
      keyId: null,
      nonce: "0".repeat(32),
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
        protocol: 2,
        plugin: {
          ...info,
          ...overrides,
        },
        keyId: null,
        nonce: "0".repeat(32),
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

  it("decodes the pairing and challenge messages", () => {
    const nonce = "a".repeat(32);
    const proof = "b".repeat(64);

    expect(
      decodeServerToPlugin(
        JSON.stringify({
          type: "challenge",
          nonce,
          proof,
        }),
      )?.type,
    ).toBe("challenge");
    expect(
      decodeServerToPlugin(
        JSON.stringify({
          type: "pairing_required",
          reason: "no_key",
          attemptsLeft: 5,
          expiresInMs: 120_000,
        }),
      )?.type,
    ).toBe("pairing_required");
    expect(
      decodeServerToPlugin(
        JSON.stringify({
          type: "paired",
          key: {
            id: "c".repeat(16),
            secret: "d".repeat(64),
          },
        }),
      )?.type,
    ).toBe("paired");
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "pair",
          code: "012345",
        }),
      )?.type,
    ).toBe("pair");
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "pair",
          code: "12345",
        }),
      ),
    ).toBeNull();
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "auth",
          proof,
        }),
      )?.type,
    ).toBe("auth");
    expect(
      decodePluginToServer(
        JSON.stringify({
          type: "auth",
          proof: "zz",
        }),
      ),
    ).toBeNull();
  });

  it("maps an error code it does not know to OP_FAILED", () => {
    expect(
      fromWireError({
        code: "SOMETHING_NEW",
        message: "from a newer plugin",
      }).code,
    ).toBe("OP_FAILED");
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
