import { expect, it } from "vitest";
import { FontAxesSchema } from "@/shared/ops/apply/apply.schema.ts";

const RANGE = { min: 100, max: 900 };

// QA NEW-090: the ranges come with a call from the server, so what a call can hold is bounded like the rest of its input.
it("holds the ranges of at most a call's cap of families, and a family's of at most its cap of axes", () => {
  const families = (count: number) =>
    Object.fromEntries([...Array(count).keys()].map((index) => [`F${index}`, { wght: RANGE }]));
  const axes = (count: number) => ({
    Flex: Object.fromEntries([...Array(count).keys()].map((index) => [`ax${index}`, RANGE])),
  });

  expect(FontAxesSchema.safeParse(families(20)).success).toBe(true);
  expect(FontAxesSchema.safeParse(families(21)).success).toBe(false);
  expect(FontAxesSchema.safeParse(axes(64)).success).toBe(true);
  expect(FontAxesSchema.safeParse(axes(65)).success).toBe(false);
});
