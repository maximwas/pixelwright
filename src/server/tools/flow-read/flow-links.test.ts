import { describe, expect, it } from "vitest";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { FlowLinks } from "@/server/tools/flow-read/flow-links.ts";
import type { FlowsRaw } from "@/shared/ops/flows/flows.schema.ts";

const links = new FlowLinks(new InteractionAttributes(new EasingCss(new NumberFormat())));

const HOME = { id: "9:1", name: "Home", width: 375, height: 812 };
const DETAIL = { id: "9:3", name: "Detail", width: 375, height: 812 };

/** Home's Open goes to Detail with a smart animate and turns to its hover state; Detail's Back goes back, Docs opens a URL. */
const PROTOTYPE: FlowsRaw = {
  page: "App",
  starts: [{ id: "9:1", name: "Main" }],
  screens: [HOME, DETAIL],
  layers: [
    {
      screen: "9:1",
      id: "9:2",
      name: "Open",
      reactions: [
        {
          trigger: { type: "ON_CLICK" },
          actions: [
            {
              type: "NODE",
              destinationId: "9:3",
              destinationName: "Detail",
              navigation: "NAVIGATE",
              transition: { type: "SMART_ANIMATE", duration: 0.3, easing: { type: "EASE_OUT" } },
            },
          ],
        },
        {
          trigger: { type: "ON_HOVER" },
          actions: [{ type: "NODE", destinationId: "9:7", destinationName: "State=Hover", navigation: "CHANGE_TO" }],
        },
      ],
    },
    {
      screen: "9:3",
      id: "9:4",
      name: "Back",
      reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "BACK" }] }],
    },
    {
      screen: "9:3",
      id: "9:5",
      name: "Docs",
      reactions: [{ trigger: { type: "ON_CLICK" }, actions: [{ type: "URL", url: "https://pixelwright.dev/docs" }] }],
    },
  ],
  more: false,
};

describe("FlowLinks", () => {
  // T-088, P-121: every interaction that leaves its layer, a variant switch left inside its component.
  it("maps the prototype: where flows start, the screens, and which layer goes where, how", () => {
    const home = { id: "9:1", name: "Home" };
    const detail = { id: "9:3", name: "Detail" };

    expect(links.map(PROTOTYPE)).toEqual({
      page: "App",
      starts: [{ id: "9:1", name: "Main" }],
      screens: [HOME, DETAIL],
      links: [
        {
          from: home,
          layer: { id: "9:2", name: "Open" },
          trigger: "ON_CLICK",
          action: "NAVIGATE",
          to: detail,
          summary: "go to Detail; smart animate 300ms ease-out",
        },
        {
          from: detail,
          layer: { id: "9:4", name: "Back" },
          trigger: "ON_CLICK",
          action: "BACK",
          to: null,
          summary: expect.any(String),
        },
        {
          from: detail,
          layer: { id: "9:5", name: "Docs" },
          trigger: "ON_CLICK",
          action: "URL",
          to: null,
          url: "https://pixelwright.dev/docs",
          summary: "open https://pixelwright.dev/docs",
        },
      ],
      more: false,
    });
  });
});
