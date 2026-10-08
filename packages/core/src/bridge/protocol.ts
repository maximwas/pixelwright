// Bridge protocol between the MCP server and the Figma plugin. Runtime-agnostic (Node + browser).
import type * as z from "zod";
import { PluginToServerSchema, ServerToPluginSchema } from "../schemas/bridge.ts";
import type { BridgeErrorCode, PluginToServer, ServerToPlugin, WireError } from "../types/bridge.ts";

export class BridgeError extends Error {
  readonly code: BridgeErrorCode;
  readonly data: unknown;

  constructor(code: BridgeErrorCode, message: string, data?: unknown) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.data = data;
  }
}

export function encode(message: PluginToServer | ServerToPlugin): string {
  return JSON.stringify(message);
}

function decodeWith<T>(schema: z.ZodType<T>, raw: string): T | null {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = schema.safeParse(json);

  return parsed.success ? parsed.data : null;
}

export const decodePluginToServer = (raw: string): PluginToServer | null => decodeWith(PluginToServerSchema, raw);
export const decodeServerToPlugin = (raw: string): ServerToPlugin | null => decodeWith(ServerToPluginSchema, raw);

/** The error of a failed response: a BridgeError keeps its code and data, anything else is OP_FAILED. */
export function toWireError(error: unknown): WireError {
  if (error instanceof BridgeError) {
    return {
      code: error.code,
      message: error.message,
      data: error.data ?? null,
    };
  }

  return {
    code: "OP_FAILED",
    message: error instanceof Error ? error.message : String(error),
  };
}

/** Restores a response's error on the receiving side. */
export function fromWireError(wire: WireError): BridgeError {
  return new BridgeError(wire.code, wire.message, wire.data);
}
