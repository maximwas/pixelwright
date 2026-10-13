import { describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

/** A button whose hover is its Hover variant, as a design file has it: the variant is the interaction's destination. */
const page = () =>
  tree({
    id: "0:1",
    type: "PAGE",
    children: [
      {
        id: "5:2",
        type: "COMPONENT",
        name: "Type=Hover",
      },
      {
        id: "1:2",
        type: "INSTANCE",
        name: "Button",
        reactions: [
          {
            trigger: { type: "ON_HOVER" },
            actions: [
              {
                type: "NODE",
                destinationId: "5:2",
                navigation: "CHANGE_TO",
                transition: {
                  type: "SMART_ANIMATE",
                  duration: 0.3,
                  easing: { type: "EASE_OUT" },
                },
              },
            ],
          },
        ],
      },
    ],
  });

describe("prototype interactions in a snapshot", () => {
  it("come with each destination's name", async () => {
    installFigma(page());

    const snapshot = (await runOperation("snapshot", { node: "1:2" })) as {
      root: { reactions?: { actions: { destinationName?: string; navigation?: string }[] }[] };
    };

    expect(snapshot.root.reactions?.[0]?.actions[0]).toMatchObject({
      navigation: "CHANGE_TO",
      destinationName: "Type=Hover",
    });
  });
});
