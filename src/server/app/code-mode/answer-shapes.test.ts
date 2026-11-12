import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { AnswerShapes } from "@/server/app/code-mode/answer-shapes.ts";

describe("AnswerShapes", () => {
  it("gives each object's keys and the shapes under them: array items, record values, union and nullable branches", () => {
    const output = zod.object({
      nodes: zod.array(zod.object({ id: zod.string(), box: zod.optional(zod.object({ x: zod.number() })) })),
      more: zod.boolean(),
      tokens: zod.record(zod.string(), zod.object({ value: zod.string() })),
      pick: zod.union([zod.object({ a: zod.string() }), zod.object({ b: zod.string() })]),
      parent: zod.nullable(zod.object({ id: zod.string() })),
    });

    expect(new AnswerShapes().shape(output)).toEqual({
      keys: ["nodes", "more", "tokens", "pick", "parent"],
      fields: {
        nodes: { items: { keys: ["id", "box"], fields: { box: { keys: ["x"] } } } },
        tokens: { values: { keys: ["value"] } },
        pick: { keys: ["a", "b"] },
        parent: { keys: ["id"] },
      },
    });
  });

  it("ends a recursive type where it repeats, and gives no shape to a tool without an output schema", () => {
    const Tree = zod.object({
      id: zod.string(),
      get children() {
        return zod.array(Tree);
      },
    });

    expect(new AnswerShapes().shape(Tree)?.keys).toEqual(["id", "children"]);
    expect(new AnswerShapes().shape(undefined)).toBeUndefined();
  });
});
