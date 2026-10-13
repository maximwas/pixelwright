import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { ContentToolDefinition, ToolDefinition } from "../types/mcp.ts";
import type { SupportNotes } from "../types/support.ts";
import { describeError } from "./describe-error.ts";

/**
 * Registers a tool whose result is always structuredContent validated against its outputSchema, with the same JSON
 * as text content. Claude Code shows the model only structuredContent, so hints and diagnostics live there. A tool that
 * says when it changed the file gets the weekly support note on such a result, when one is due.
 */
export function registerTool<I extends z.ZodObject, O extends z.ZodObject>(
  server: McpServer,
  tool: ToolDefinition<I, O>,
  support?: SupportNotes,
): void {
  const { name, title, description, annotations } = tool;
  const changed = support === undefined ? undefined : tool.changed;
  // The SDK's overloads take a plain ZodObject, not one narrowed by a type parameter.
  const inputSchema: z.ZodObject = tool.input;
  const outputSchema: z.ZodObject =
    changed === undefined ? tool.output : tool.output.extend({ support: z.string().exactOptional() });

  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
    },
    async (args, extra) => {
      let result: unknown;

      try {
        // The SDK has validated args already, but its callback type cannot follow a generic schema: parsing types them.
        result = await tool.run(tool.input.parse(args), extra.mcpReq.signal);
      } catch (error) {
        throw new Error(describeError(error), { cause: error });
      }

      const data: Record<string, unknown> = outputSchema.parse(result);
      const note = changed?.(tool.output.parse(result)) ? await support?.due() : null;

      if (typeof note === "string") {
        data.support = note;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data),
          },
        ],
        structuredContent: data,
      };
    },
  );
}

/**
 * Registers a tool that answers with content blocks of its own and no outputSchema: Claude Code would show the model
 * only structuredContent and drop an image, and XML reads best as plain text.
 */
export function registerContentTool<I extends z.ZodObject>(server: McpServer, tool: ContentToolDefinition<I>): void {
  // The SDK's overloads take a plain ZodObject, not one narrowed by a type parameter.
  const inputSchema: z.ZodObject = tool.input;

  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema,
      annotations: tool.annotations,
    },
    async (args) => {
      try {
        return await tool.run(tool.input.parse(args));
      } catch (error) {
        throw new Error(describeError(error), { cause: error });
      }
    },
  );
}
