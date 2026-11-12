import { describe, expect, it } from "vitest";
import { PAINTS_TEXT } from "@/plugin/adapters/figma/figma.constants.ts";
import type { Paints } from "@/plugin/adapters/figma/paints.ts";
import { PaintWrite } from "@/plugin/operations/apply/writers/paint-write.ts";

// A token index that knows nothing: an image paint must be refused without asking it anything.
const tokens = { style: async () => null, check: async () => undefined } as never;

describe("PaintWrite.check", () => {
  // QA of item 41: the image refusal came from the write only, so a dry run said OK and a real run failed after other
  // steps of the element had written.
  it("refuses an image paint before any write, as the write does", async () => {
    const write = new PaintWrite(tokens, {} as Paints);

    await expect(write.check([{ kind: "image" }])).rejects.toThrow(PAINTS_TEXT.image);
  });
});
