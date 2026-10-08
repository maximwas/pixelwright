import type { McpServer } from "@modelcontextprotocol/server";
import type * as z from "zod";
import type { ToolDefinition } from "../types/mcp.ts";
import { describeError } from "./describe-error.ts";

/**
 * Registers a tool whose result is always structuredContent validated against its outputSchema, with the same JSON
 * as text content. Claude Code shows the model only structuredContent, so hints and diagnostics live there.
 */
export function registerTool<I extends z.ZodObject, O extends z.ZodObject>(
  server: McpServer,
  tool: ToolDefinition<I, O>,
): void {
  const { name, title, description, annotations } = tool;
  // The SDK's overloads take a plain ZodObject, not one narrowed by a type parameter.
  const inputSchema: z.ZodObject = tool.input;
  const outputSchema: z.ZodObject = tool.output;

  server.registerTool(
    name,
    {
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
    },
    async (args) => {
      let result: unknown;

      try {
        // The SDK has validated args already, but its callback type cannot follow a generic schema: parsing types them.
        result = await tool.run(tool.input.parse(args));
      } catch (error) {
        throw new Error(describeError(error), { cause: error });
      }

      const data: Record<string, unknown> = outputSchema.parse(result);

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
