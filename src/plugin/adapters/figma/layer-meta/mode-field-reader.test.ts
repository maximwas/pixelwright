import { expect, it } from "vitest";
import { ModeFieldReader } from "@/plugin/adapters/figma/layer-meta/mode-field-reader.ts";
import type { NodeLookup } from "@/plugin/adapters/figma/lookup/node-lookup.ts";

const COLLECTIONS: Record<string, { name: string; defaultModeId: string; modes: { modeId: string; name: string }[] }> =
  {
    "C:theme": {
      name: "Theme",
      defaultModeId: "M:light",
      modes: [
        { modeId: "M:light", name: "Light" },
        { modeId: "M:dark", name: "Dark" },
      ],
    },
    "C:brand": {
      name: "Brand",
      defaultModeId: "M:ocean",
      modes: [
        { modeId: "M:ocean", name: "Ocean" },
        { modeId: "M:sun", name: "Sun" },
      ],
    },
    "C:density": {
      name: "Density",
      defaultModeId: "M:roomy",
      modes: [
        { modeId: "M:roomy", name: "Roomy" },
        { modeId: "M:tight", name: "Tight" },
      ],
    },
  };

const lookup = {
  collection: async (id: string) => (COLLECTIONS[id] ?? null) as VariableCollection | null,
} as NodeLookup;

// A card inside a section set to Dark: the card sets Brand itself, takes Theme from above, and Density is the default.
const card = {
  type: "FRAME",
  explicitVariableModes: { "C:brand": "M:sun" },
  resolvedVariableModes: { "C:theme": "M:dark", "C:brand": "M:sun", "C:density": "M:roomy" },
} as Pick<FrameNode, "type" | "explicitVariableModes" | "resolvedVariableModes"> as SceneNode;

// m:c8a83979: a read's root also says the non-default modes it takes from above, so a read sent back writes nothing.
it("gives the read's root its inherited non-default modes before its own, and a layer below only its own", async () => {
  const reader = new ModeFieldReader(lookup);
  const origin = { x: 0, y: 0 };

  expect(await reader.read(card, origin, true)).toEqual({
    modes: [
      { collection: "Theme", mode: "Dark" },
      { collection: "Brand", mode: "Sun" },
    ],
  });
  expect(await reader.read(card, origin, false)).toEqual({ modes: [{ collection: "Brand", mode: "Sun" }] });
});
