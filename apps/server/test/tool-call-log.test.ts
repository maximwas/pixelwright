import type { JSONRPCMessage, Transport } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { ToolCallLog } from "../src/logging/tool-call-log.ts";

/** A transport the test speaks through: what arrives, and what was sent back. */
class FakeTransport implements Transport {
  onmessage?: Transport["onmessage"];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  readonly sent: JSONRPCMessage[] = [];

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.sent.push(message);
  }

  async close(): Promise<void> {}

  receive(message: JSONRPCMessage): void {
    this.onmessage?.(message);
  }
}

function logged() {
  const lines: { level: string; fields: Record<string, unknown>; message: string }[] = [];
  const logger = {
    info: (fields: Record<string, unknown>, message: string) =>
      lines.push({
        level: "info",
        fields,
        message,
      }),
    warn: (fields: Record<string, unknown>, message: string) =>
      lines.push({
        level: "warn",
        fields,
        message,
      }),
  };

  return {
    logger,
    lines,
  };
}

const call = (id: number, name: string, file?: string): JSONRPCMessage => ({
  jsonrpc: "2.0",
  id,
  method: "tools/call",
  params: {
    name,
    arguments: file === undefined ? {} : { file },
  },
});

describe("every tool call in the log", () => {
  it("names the tool, the file and how long it took; a failure at warn with its message", async () => {
    const inner = new FakeTransport();
    const { logger, lines } = logged();
    const transport = new ToolCallLog(inner, logger);
    const received: JSONRPCMessage[] = [];

    transport.onmessage = (message) => received.push(message);
    await transport.start();

    inner.receive(call(1, "design_read", "Test MCP"));
    await transport.send({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [] },
    });
    inner.receive(call(2, "design_apply"));
    await transport.send({
      jsonrpc: "2.0",
      id: 2,
      result: {
        isError: true,
        content: [
          {
            type: "text",
            text: "Allow edits is off in the Pixelwright plugin window\nmore",
          },
        ],
      },
    });
    inner.receive({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    });
    await transport.send({
      jsonrpc: "2.0",
      id: 3,
      result: { tools: [] },
    });

    expect(received).toHaveLength(3);
    expect(inner.sent).toHaveLength(3);
    expect(lines).toEqual([
      {
        level: "info",
        message: "tool design_read",
        fields: {
          file: "Test MCP",
          ms: expect.any(Number),
        },
      },
      {
        level: "warn",
        message: "tool design_apply failed",
        fields: {
          ms: expect.any(Number),
          error: "Allow edits is off in the Pixelwright plugin window",
        },
      },
    ]);
  });

  it("logs a call the client cancelled as cancelled, and forgets it", async () => {
    const inner = new FakeTransport();
    const { logger, lines } = logged();
    const transport = new ToolCallLog(inner, logger);

    await transport.start();
    inner.receive(call(1, "design_read", "Test MCP"));
    inner.receive({
      jsonrpc: "2.0",
      method: "notifications/cancelled",
      params: { requestId: 1 },
    });
    await transport.send({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [] },
    });

    expect(lines).toEqual([
      {
        level: "info",
        message: "tool design_read cancelled",
        fields: {
          file: "Test MCP",
          ms: expect.any(Number),
        },
      },
    ]);
  });

  it("passes on what the transport it wraps can do besides sending", async () => {
    const inner = Object.assign(new FakeTransport(), {
      versions: [] as string[],
      hasPerRequestStream: true,
      setProtocolVersion(version: string) {
        this.versions.push(version);
      },
      setSupportedProtocolVersions(versions: string[]) {
        this.versions.push(...versions);
      },
    });
    const transport = new ToolCallLog(inner, logged().logger);

    transport.setProtocolVersion?.("2025-06-18");
    transport.setSupportedProtocolVersions?.(["2025-03-26"]);

    expect(inner.versions).toEqual(["2025-06-18", "2025-03-26"]);
    expect(transport.hasPerRequestStream).toBe(true);
    expect(new ToolCallLog(new FakeTransport(), logged().logger).setProtocolVersion).toBeUndefined();
  });
});
