import { describe, expect, it } from "vitest";
import { ComponentAttributes } from "@/core/design/component/component-attributes.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";

const attributes = new ComponentAttributes(new NameValueList());

function layer(fields: Partial<ReadLayer>): ReadLayer {
  return {
    id: "1:1",
    name: "Layer",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    childCount: 0,
    ...fields,
  };
}

describe("ComponentAttributes", () => {
  // C-133: the overridden fields in CSS words, each once, in one order, noise and Figma's stokeTopWeight typo handled.
  it("writes what an instance overrode in CSS words, in one order, each once, noise left out", () => {
    const override = (type: string, overrides: string[]) => attributes.override(layer({ type, overrides }));

    expect(override("INSTANCE", ["width", "name", "strokes", "stokeTopWeight"])).toBe("border");
    expect(override("FRAME", ["characters", "styledTextSegments", "foo"])).toBe("text, foo");
    expect(override("TEXT", ["fontSize", "visible", "fills"])).toBe("color, visibility, font");
    expect(override("FRAME", ["name", "height", "annotations", "reactions", "componentProperties"])).toBeUndefined();
    expect(override("FRAME", ["expanded", "locked", "pluginData", "relativeTransform", "constraints"])).toBeUndefined();
    expect(override("FRAME", ["fillStyleId", "effectStyleId", "minWidth"])).toBe("background, box-shadow, size");
    expect(override("TEXT", ["fillStyleId"])).toBe("color");
  });

  it("names an instance's set, its variant and its own properties bare and escaped, and marks it exposed", () => {
    const instance = layer({
      type: "INSTANCE",
      instance: {
        componentId: "4:1",
        componentName: "Style=Solid",
        setName: "Badge",
        exposed: true,
        properties: {
          Style: { type: "VARIANT", value: "Solid" },
          "Label#3:1": { type: "TEXT", value: "a,b=c\\" },
          "Shown#3:2": { type: "BOOLEAN", value: false },
          "Icon#3:3": { type: "INSTANCE_SWAP", value: "7:1" },
        },
      },
    });

    expect(attributes.instance(instance)).toEqual([
      ["component", "Badge"],
      ["variant", "Style=Solid"],
      ["props", "Label=a\\,b\\=c\\\\, Shown=false"],
      ["$exposed", "true"],
    ]);
  });

  // C-135: the attribute tokens_read's CSS selects on, any script kept.
  it("writes a layer's variable modes as data attributes named by slug", () => {
    const moded = layer({
      modes: [
        { collection: "Color modes", mode: "Dark" },
        { collection: "Тема", mode: "Ocean Blue" },
      ],
    });

    expect(attributes.modes(moded)).toEqual([
      ["data-color-modes", "dark"],
      ["data-тема", "ocean-blue"],
    ]);
  });
});
