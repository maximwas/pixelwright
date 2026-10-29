import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { CssReader } from "@/core/css/css-reader.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { GroupRegistry } from "@/core/css/registry/group-registry.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { DesignXml } from "@/core/design/design-xml.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

/**
 * The 0.7.0 design XML as the oracle, attribute by attribute: each item adds the names its groups own, until item 24
 * compares the XML byte for byte. Values are compared for the element ids both reads have.
 */
const OWNED = [
  // Item 15: the layout group.
  "display",
  "flex-direction",
  "flex-wrap",
  "padding",
  "justify-content",
  "align-items",
  "align-content",
  "gap",
  "column-gap",
  "row-gap",
  "grid-template-columns",
  "grid-template-rows",
];

/** Deliberate or not-yet differences from 0.7.0, each with the decision or item that settles it; never a silent skip. */
const KNOWN: readonly { fixture: string; id: string; attribute: string; why: string }[] = [];

const FIXTURES = ["desktop-top", "pricing", "plans", "customers"] as const;

const format = new NumberFormat();
const design = new DesignXml(
  new LayerTree(
    new DesignBuilder(
      new NodeTag(),
      new NameValueList(),
      new CssReader(new GroupRegistry([new LayoutGroup(new CssLength(new CssVar(new CssSplit()), format), format)])),
    ),
  ),
  new XmlWriter(new XmlEscape()),
);

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

/** Each element's attributes by its id: one element per line, as both writers put them. */
function elements(xml: string): Map<string, Map<string, string>> {
  const found = new Map<string, Map<string, string>>();

  for (const line of xml.split("\n")) {
    const attributes = new Map(
      [...line.matchAll(/\s([\w$:-]+)="([^"]*)"/g)].map(([, name = "", value = ""]) => [name, value]),
    );
    const id = attributes.get("id");

    if (id !== undefined) {
      found.set(id, attributes);
    }
  }

  return found;
}

/**
 * The px a golden's var() stands for: 0.7.0 wrote bound variables as tokens, which come in item 20; until then the
 * values are compared through the fixture's variable values (Orbit names its tokens after them: space/64 = --space-64).
 */
function withoutTokens(value: string, model: ReadModel): string {
  const pixels = new Map(
    Object.values(model.variables).flatMap((variable) =>
      typeof variable.value === "number" ? [[`--${variable.name.replaceAll("/", "-")}`, variable.value]] : [],
    ),
  );

  return value.replace(/var\((--[^)]+)\)/g, (token, name: string) => {
    const pixel = pixels.get(name);

    return pixel === undefined ? token : pixel === 0 ? "0" : `${pixel}px`;
  });
}

describe("design XML attributes against the 0.7.0 goldens", () => {
  it.each(FIXTURES)("writes orbit-%s's owned attributes as 0.7.0 did", (fixture) => {
    const model = zod.parse(ReadModelSchema, JSON.parse(read(`./fixtures/orbit-${fixture}.json`)));
    const golden = elements(read(`./__golden__/orbit-${fixture}.xml`));
    const ours = elements(design.xml(model));
    const differences: string[] = [];

    for (const [id, expected] of golden) {
      const actual = ours.get(id);

      for (const attribute of actual === undefined ? [] : OWNED) {
        const want = expected.get(attribute);
        const have = actual?.get(attribute);
        const known = KNOWN.some((row) => row.fixture === fixture && row.id === id && row.attribute === attribute);

        if ((want === undefined ? undefined : withoutTokens(want, model)) !== have && !known) {
          differences.push(`${id} ${attribute}: 0.7.0 ${want ?? "-"}, now ${have ?? "-"}`);
        }
      }
    }

    expect(differences).toEqual([]);
    expect(ours.size).toBeGreaterThan(0);
  });
});
