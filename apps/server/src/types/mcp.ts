import type { ToolAnnotations } from "@modelcontextprotocol/server";
import type * as z from "zod";
import type { StatusOutputSchema } from "../schemas/status.ts";
import type { BridgeStatus, ConnectedPlugin, PairingStatus } from "./bridge.ts";

/** What tools need from the plugin bridge (PluginBridge implements it). */
export interface BridgeView {
  status(): BridgeStatus;
  plugins(): readonly ConnectedPlugin[];
  pairing(): PairingStatus | null;
  request(op: string, input: unknown): Promise<unknown>;
}

export interface ToolContext {
  readonly bridge: BridgeView;
  readonly version: string;
}

export interface ToolDefinition<I extends z.ZodObject, O extends z.ZodObject> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: I;
  readonly output: O;
  readonly annotations: ToolAnnotations;
  run(args: z.output<I>): Promise<z.input<O>>;
}

export type StatusOutput = z.output<typeof StatusOutputSchema>;
