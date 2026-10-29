import { expect, it } from "vitest";
import { AppearanceFieldReader } from "@/plugin/adapters/figma/layer-read/appearance-field-reader.ts";

const frame = (gridStyleId: string) =>
  ({ type: "FRAME", layoutGrids: [], gridStyleId }) as Pick<
    FrameNode,
    "type" | "layoutGrids" | "gridStyleId"
  > as SceneNode;

// C-1.5: a frame's layout grid style reaches the model, so the read writes $grid-style.
it("reads a frame's layout grid style, and none when it has none", () => {
  const reader = new AppearanceFieldReader();

  expect(reader.read(frame("S:grid,1:2"))).toMatchObject({ gridStyleId: "S:grid,1:2" });
  expect(reader.read(frame(""))).not.toHaveProperty("gridStyleId");
});
