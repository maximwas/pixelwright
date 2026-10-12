import type { ToolAnnotations } from "@modelcontextprotocol/server";
import type * as z from "zod";
import type { WrittenFiles } from "../assets/written-files.ts";
import type { StatusOutputSchema } from "../schemas/status.ts";
import type { BridgeStatus, ConnectedPlugin, PairingStatus, RequestOptions } from "./bridge.ts";

/** What tools need from the plugin bridge (PluginBridge implements it). */
export interface BridgeView {
  status(): BridgeStatus;
  plugins(): readonly ConnectedPlugin[];
  pairing(): PairingStatus | null;
  request(op: string, input: unknown, options?: RequestOptions): Promise<unknown>;
}

export interface ToolContext {
  readonly bridge: BridgeView;
  readonly version: string;
  /** The files design_read and assets_export wrote, which design_apply knows again. */
  readonly files: WrittenFiles;
  /** The project folder, where Code Connect templates are looked for. */
  readonly projectRoot: string;
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
