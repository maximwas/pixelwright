import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import * as zod from "zod/mini";
import { TOOL_JSON_SCHEMA } from "./mcp-tool-schema.constants.ts";

type Props<Schema extends zod.ZodMiniType> = StandardSchemaWithJSON<zod.input<Schema>, zod.output<Schema>>["~standard"];

/**
 * Adapter: a zod/mini schema as the Standard Schema with JSON the SDK takes. Mini schemas lack `~standard.jsonSchema`,
 * so the SDK refuses their type and, untyped, warns on stderr and converts them itself; this gives it the same
 * z.toJSONSchema output (pinned by the tools.json golden) and leaves validation to zod's own `~standard`.
 */
export class McpToolSchema<Schema extends zod.ZodMiniType>
implements StandardSchemaWithJSON<zod.input<Schema>, zod.output<Schema>>
{
  readonly "~standard": Props<Schema>;

  constructor(schema: Schema) {
    this["~standard"] = {
      ...schema["~standard"],
      // The SDK asks for draft 2020-12 only, the target its own fallback uses.
      jsonSchema: {
        input: () =>
          zod.toJSONSchema(schema, {
            target: TOOL_JSON_SCHEMA.target,
            io: TOOL_JSON_SCHEMA.input,
          }),
        output: () =>
          zod.toJSONSchema(schema, {
            target: TOOL_JSON_SCHEMA.target,
            io: TOOL_JSON_SCHEMA.output,
          }),
      },
    };
  }
}
