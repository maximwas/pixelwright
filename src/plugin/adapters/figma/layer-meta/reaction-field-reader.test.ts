import { expect, it } from "vitest";
import { ReactionFieldReader } from "@/plugin/adapters/figma/layer-meta/reaction-field-reader.ts";
import type { NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";

// P-089: an older file keeps one `action`; each destination's name is looked up once, the URL a reaction opens is href.
it("reads a reaction's single action as a list and names each destination once", async () => {
  const asked: string[] = [];
  const lookup = {
    node: async (id: string) => {
      asked.push(id);

      return { name: `Screen ${id}` } as BaseNode;
    },
  } as NodeLookup;
  const go = (destinationId: string) =>
    ({ type: "NODE", destinationId, navigation: "NAVIGATE", transition: null }) as Action;
  const reactions = [
    { trigger: { type: "ON_CLICK" }, action: go("1:2") },
    { trigger: { type: "ON_HOVER" }, actions: [go("1:2"), go("1:3")] },
    { trigger: { type: "ON_PRESS" }, actions: [{ type: "URL", url: "https://orbit.test" }] },
  ] as Reaction[];
  const node = { type: "FRAME", reactions } as Pick<FrameNode, "type" | "reactions"> as SceneNode;

  expect(await new ReactionFieldReader(lookup).read(node)).toEqual({
    href: "https://orbit.test",
    reactions: [
      { trigger: { type: "ON_CLICK" }, actions: [{ ...go("1:2"), destinationName: "Screen 1:2" }] },
      {
        trigger: { type: "ON_HOVER" },
        actions: [
          { ...go("1:2"), destinationName: "Screen 1:2" },
          { ...go("1:3"), destinationName: "Screen 1:3" },
        ],
      },
      { trigger: { type: "ON_PRESS" }, actions: [{ type: "URL", url: "https://orbit.test" }] },
    ],
  });
  expect(asked).toEqual(["1:2", "1:3"]);
});
