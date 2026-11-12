import { describe, expect, it } from "vitest";
import { findStates } from "../src/features/states-find/find-states.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { scopeBridge } from "./helpers/scope-bridge.ts";

const BUTTON = {
  id: "S:1",
  key: "k",
  type: "COMPONENT_SET",
  name: "Button",
  page: "Components",
  remote: false,
  properties: {
    State: {
      type: "VARIANT",
      default: "Default",
      options: ["Default", "Hover"],
    },
  },
};

describe("states_find", () => {
  it("checks the components a page uses and the page's screens, with nothing selected", async () => {
    const view = scopeBridge({
      selection: [],
      pages: [
        {
          id: "0:1",
          name: "App",
          nodes: [
            {
              id: "1:1",
              name: "Inbox",
            },
            {
              id: "1:2",
              name: "Inbox – Loading",
            },
          ],
        },
      ],
      answers: {
        components: {
          components: [BUTTON],
          more: false,
        },
      },
    });
    const found = await findStates(new PluginClient(view.bridge), {});

    expect(view.inputs.components).toMatchObject({
      scope: "used",
      within: "0:1",
    });
    expect(found.components.map(({ name, missing }) => `${name}: ${missing.join(", ")}`)).toEqual([
      "Button: focus, pressed, disabled",
    ]);
    expect(found.screens).toMatchObject([
      {
        name: "Inbox",
        states: ["loading"],
        missing: ["empty", "error"],
      },
    ]);
  });

  it("checks the file's own components for the file", async () => {
    const view = scopeBridge({
      selection: [],
      answers: {
        components: {
          components: [],
          more: false,
        },
      },
    });
    const found = await findStates(new PluginClient(view.bridge), { within: "file" });

    expect(view.inputs.components).toMatchObject({ scope: "local" });
    expect(found.notes).toEqual([
      "The file defines no component named as interactive (button, field, toggle, tab, link).",
    ]);
  });
});
