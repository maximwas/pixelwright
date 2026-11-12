import { describe, expect, it } from "vitest";
import { InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { EasingCss } from "@/core/kernel/easing/easing-css.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";

const interactions = new InteractionAttributes(new EasingCss(new NumberFormat()));

// C-154: one $on-* per trigger, each interaction a sentence; a reaction that only opens a URL is href's.
describe("InteractionAttributes", () => {
  it("writes a click that navigates as Orbit's Pro card does: where, how, how long, the easing", () => {
    expect(
      interactions.read([
        {
          trigger: { type: "ON_CLICK" },
          actions: [
            {
              type: "NODE",
              destinationId: "54:404",
              destinationName: "Checkout – Desktop",
              navigation: "NAVIGATE",
              transition: { type: "DISSOLVE", duration: 0.30000001192092896, easing: { type: "EASE_OUT" } },
            },
          ],
        },
        { trigger: { type: "ON_CLICK" }, actions: [{ type: "URL", url: "https://orbit.test" }] },
      ]),
    ).toEqual([["$on-click", "go to Checkout – Desktop; dissolve 300ms ease-out"]]);
  });

  it("says when a URL opens in a new tab", () => {
    const open = (openInNewTab: boolean) => ({
      trigger: { type: "ON_CLICK" },
      actions: [{ type: "URL", url: "https://orbit.test", openInNewTab }],
    });

    expect(interactions.sentence(open(true))).toBe("open https://orbit.test in a new tab");
    expect(interactions.sentence(open(false))).toBe("open https://orbit.test");
  });

  it("joins a trigger's interactions, words waits, directions, springs and triggers it has no name for", () => {
    const change = (destinationName: string, easing: { type: string }) => ({
      type: "NODE",
      destinationName,
      navigation: "CHANGE_TO",
      transition: { type: "MOVE_IN", direction: "LEFT", duration: 0.2, easing },
    });

    expect(
      interactions.read([
        { trigger: { type: "ON_HOVER" }, actions: [change("Type=Hover", { type: "EASE_IN_BACK" })] },
        { trigger: { type: "ON_HOVER" }, actions: [change("Type=Glow", { type: "GENTLE" })] },
        { trigger: { type: "AFTER_TIMEOUT", timeout: 0.8 }, actions: [{ type: "BACK" }] },
        { trigger: { type: "ON_SWIPE" }, actions: [{ type: "NODE", destinationId: "9:9", transition: null }] },
        { trigger: null, actions: [{ type: "BACK" }] },
      ]),
    ).toEqual([
      [
        "$on-hover",
        "change to Type=Hover; move in left 200ms cubic-bezier(0.36, 0, 0.66, -0.56) | change to Type=Glow; move in left 200ms gentle",
      ],
      ["$after-timeout", "after 800ms; back"],
      ["$on-swipe", "go to 9:9; instant"],
    ]);
  });
});
