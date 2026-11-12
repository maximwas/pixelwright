import { describe, expect, it } from "vitest";
import { type ComponentEntry, statesFind } from "../src/index.ts";

const set = (id: string, name: string, states: string[]): ComponentEntry => ({
  id,
  key: id,
  type: "COMPONENT_SET",
  name,
  page: "Components",
  remote: false,
  properties: {
    State: {
      type: "VARIANT",
      default: states[0] ?? "Default",
      options: states,
    },
  },
});

const screen = (id: string, name: string) => ({
  id,
  name,
});

describe("states_find", () => {
  const found = statesFind({
    components: [
      set("S:1", "Button", ["Default", "Hover", "Pressed", "Focused", "Disabled"]),
      set("S:2", "Text field", ["Default", "Focus"]),
      set("S:3", "Avatar", ["Small", "Large"]),
    ],
    screens: [
      screen("1:1", "Inbox – Desktop"),
      screen("1:2", "Inbox – Empty"),
      screen("1:3", "Inbox – Mobile"),
      screen("1:4", "Checkout"),
      screen("1:5", "Checkout / Error"),
      screen("1:6", "About us"),
    ],
  });

  it("lists interactive components with the states they have and lack, most missing first", () => {
    expect(
      found.components.map(({ name, kind, missing }) => `${name} (${kind}): ${missing.join(", ") || "complete"}`),
    ).toEqual(["Text field (field): hover, disabled, error", "Button (button): complete"]);
  });

  it("groups a screen's frames by its name and says which states a list or a form lacks", () => {
    expect(found.screens).toEqual([
      {
        name: "Inbox",
        kind: "list",
        frames: ["1:1", "1:2", "1:3"],
        states: ["empty"],
        missing: ["loading", "error"],
      },
      {
        name: "Checkout",
        kind: "form",
        frames: ["1:4", "1:5"],
        states: ["error"],
        missing: ["success"],
      },
    ]);
  });

  it("sums up", () => {
    expect(found.summary).toBe(
      "2 interactive components, 1 of them missing states; 2 screens with data or forms, 2 of them missing states.",
    );
  });
});
