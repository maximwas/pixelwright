import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/server";
import type * as z from "zod";
import type { WrittenFiles } from "../assets/written-files.ts";
import type { StatusOutputSchema } from "../schemas/status.ts";
import type { BridgeStatus, ConnectedPlugin, PairingStatus, RequestOptions } from "./bridge.ts";
import type { SupportNotes } from "./support.ts";

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
  /** The weekly support note, added to a write's result after a change that worked. */
  readonly support: SupportNotes;
}

export interface ToolDefinition<I extends z.ZodObject, O extends z.ZodObject> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: I;
  readonly output: O;
  readonly annotations: ToolAnnotations;
  /** `signal` aborts when the client cancels the call. */
  run(args: z.output<I>, signal: AbortSignal): Promise<z.input<O>>;
  /** For a tool that writes: whether this result changed the file, which is when the support note may ride on it. */
  changed?(output: z.output<O>): boolean;
}

/** A tool that answers with content blocks of its own (an image, XML as text) and has no outputSchema. */
export interface ContentToolDefinition<I extends z.ZodObject> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: I;
  readonly annotations: ToolAnnotations;
  run(args: z.output<I>): Promise<CallToolResult>;
}

export type StatusOutput = z.output<typeof StatusOutputSchema>;
