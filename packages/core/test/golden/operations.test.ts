import { describe, expect, it } from "vitest";
import * as z from "zod";
import { OPERATION_SCHEMAS } from "../../src/index.ts";

/**
 * Every bridge operation's input and output as JSON Schema, as the code before the rewrite defined them. Both are read
 * as the wire carries them (zod's input side): the plugin parses an operation's input and the server its output, so
 * an object that strips, refuses or keeps unknown fields reads differently. A z.custom check, which JSON Schema cannot
 * say, is marked as one, so it never reads like z.unknown(). A rewrite must reproduce them byte for byte.
 */
describe("golden operations", () => {
  it("keeps every operation's input and output as the wire takes them", async () => {
    const operations = Object.fromEntries(
      Object.entries(OPERATION_SCHEMAS).map(([name, { input, output }]) => [
        name,
        {
          input: wireSchema(input),
          output: wireSchema(output),
        },
      ]),
    );

    await expect(`${JSON.stringify(operations, null, 2)}\n`).toMatchFileSnapshot("__golden__/operations.json");
  });
});

function wireSchema(schema: z.ZodType): z.core.JSONSchema.BaseSchema {
  return z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      if (zodSchema._zod.def.type === "custom") {
        jsonSchema["x-zod"] = "custom";
      }
    },
  });
}
