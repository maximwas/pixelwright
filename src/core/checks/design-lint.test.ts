import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { DesignLint } from "@/core/checks/design-lint.ts";
import { LayoutRules } from "@/core/checks/lint/layout-rules.ts";
import { LINT_RULES } from "@/core/checks/lint/lint.constants.ts";
import { LintRegistry } from "@/core/checks/lint/lint-registry.ts";
import { LintWalk } from "@/core/checks/lint/lint-walk.ts";
import { TokenRules } from "@/core/checks/lint/token-rules.ts";
import { FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { LayoutGuess } from "@/core/design/hints/layout-guess.ts";
import { TokenNames } from "@/core/kernel/names/token-names.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { type ReadModel, ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

const format = new NumberFormat();
const names = new TokenNames();
const designLint = new DesignLint(
  new LintRegistry(
    new TokenRules(
      new FontShorthand(format),
      new EffectsGroup(new SolidPaint(names), new CssLength(new CssVar(new CssSplit()), format, names), format, names),
      format,
      names,
    ),
    new LayoutRules(new LayoutGuess(format), format),
  ),
  new LintWalk(),
);

const solid = (hex: number) => ({
  type: "SOLID",
  visible: true,
  color: { r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 },
});

const layer = (
  id: string,
  name: string,
  fields: Partial<ReadLayer> = {},
): ReadLayer => ({
  id,
  name,
  type: "FRAME",
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  childCount: fields.children?.length ?? 0,
  ...fields,
});

const text = (
  id: string,
  characters: string,
  fields: Partial<ReadLayer> = {},
  style = "",
) =>
  layer(id, characters, {
    type: "TEXT",
    text: {
      characters,
      textAutoResize: "WIDTH_AND_HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      segments: [
        {
          characters,
          start: 0,
          end: characters.length,
          fontName: { family: "Inter", style: "Regular" },
          fontSize: 14,
          fontWeight: 400,
          textDecoration: "NONE",
          textCase: "ORIGINAL",
          lineHeight: { unit: "PIXELS", value: 20 },
          letterSpacing: { unit: "PIXELS", value: 0 },
          fills: [solid(0x14161f)],
          fillStyleId: "",
          textStyleId: style,
        },
      ],
    },
    ...fields,
  });

const SHADOW = {
  type: "DROP_SHADOW",
  visible: true,
  color: { r: 0, g: 0, b: 0, a: 0.2 },
  offset: { x: 0, y: 4 },
  radius: 12,
  spread: 0,
};

const SPACE = {
  name: "space-4",
  collection: "Spacing",
  resolvedType: "FLOAT",
  remote: false,
  value: 16,
  codeSyntax: { WEB: "--space-4" },
};

const modelOf = (root: ReadLayer): ReadModel =>
  zod.parse(ReadModelSchema, { root, styles: {}, variables: { "V:space": SPACE } });

/** A pricing card breaking each rule of this lint once, beside a layer that keeps it. */
const CARD = modelOf(
  layer("1:1", "Card", {
    width: 400,
    height: 600,
    layoutMode: "VERTICAL",
    itemSpacing: 16,
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 13,
    inferred: { itemSpacing: "V:space" },
    children: [
      text("1:2", "Pro", { x: 24, y: 13 }),
      text("1:3", "Free shipping on all orders over $50", { x: 24, y: 60, width: 420 }),
      text("1:11", "Styled", { x: 24, y: 40 }, "S:body"),
      layer("1:4", "Row", {
        x: 24,
        y: 90,
        width: 352,
        inferredLayout: { layoutMode: "HORIZONTAL", itemSpacing: 8 },
        children: [
          layer("1:5", "Icon", { type: "RECTANGLE", x: 24, y: 90, width: 20 }),
          layer("1:6", "Label", { type: "RECTANGLE", x: 52, y: 90 }),
        ],
      }),
      layer("1:12", "Single", {
        x: 24,
        y: 120,
        inferredLayout: { layoutMode: "HORIZONTAL" },
        children: [layer("1:15", "Dot", { type: "RECTANGLE", x: 24, y: 120, width: 20 })],
      }),
      layer("1:7", "Buy", {
        type: "INSTANCE",
        x: 24,
        y: 150,
        width: 80,
        height: 20,
        instance: { componentId: "C:btn", componentName: "Button", properties: {} },
        children: [
          layer("I1:7;2:1", "Background", {
            x: 24,
            y: 150,
            layoutMode: "VERTICAL",
            paddingTop: 13,
            effects: [SHADOW],
            height: 60,
            children: [text("I1:7;2:2", "Buy", { x: 24, y: 163 })],
          }),
        ],
      }),
      layer("1:8", "Shadow", { x: 24, y: 190, effects: [SHADOW] }),
      layer("1:13", "Styled shadow", { x: 24, y: 200, effects: [SHADOW], effectStyleId: "S:shadow" }),
      layer("1:9", "Pill", { x: 24, y: 240, cornerRadius: 19 }),
      layer("1:10", "Draft", { visible: false, layoutMode: "VERTICAL", paddingTop: 13, effects: [SHADOW] }),
    ],
  }),
);

const lint = (
  models: readonly ReadModel[],
  options: Partial<Parameters<DesignLint["lint"]>[1]> = {},
  unread = 0,
) =>
  designLint.lint({ reads: models, unread }, { limit: 100, scope: "the selection", ...options });

describe("design_lint: the registry", () => {
  // K-031: the order the rules are listed in and their severities are the contract; item 54 brings the other checks.
  it("knows 14 rules in a fixed order, each with its severity", () => {
    expect(LINT_RULES.map(({ id, severity }) => `${id} ${severity}`)).toEqual([
      "contrast error",
      "raw-color warning",
      "text-style warning",
      "detached warning",
      "no-auto-layout warning",
      "overflow warning",
      "touch-target warning",
      "missing-states info",
      "raw-number info",
      "off-scale info",
      "effect-style info",
      "overridden info",
      "default-name info",
      "leftover info",
    ]);
  });
});

describe("design_lint: the walk and the rules", () => {
  // K-032, K-036, K-037, K-038: each rule fires once on the card and stays quiet on the layer beside it that keeps it;
  // the instance's content and the hidden draft are not linted.
  it("finds each rule's breach once, the more severe first, in layer order within a severity", () => {
    const { findings, summary, rules } = lint([CARD]);

    expect(findings.map(({ severity, rule, id }) => `${severity} ${rule} ${id}`)).toEqual([
      "warning text-style 1:2",
      "warning text-style 1:3",
      "warning overflow 1:3",
      "warning no-auto-layout 1:4",
      "info raw-number 1:1",
      "info off-scale 1:1",
      "info effect-style 1:8",
    ]);
    expect(summary).toBe("7 findings in the selection: 0 errors, 4 warnings, 3 info.");
    expect(rules.map(({ rule, severity, count }) => `${rule} ${severity} ${count}`)).toEqual([
      "text-style warning 2",
      "no-auto-layout warning 1",
      "overflow warning 1",
      "raw-number info 1",
      "off-scale info 1",
      "effect-style info 1",
    ]);
  });

  it("says what each finding breaks and how to fix it, naming the tool", () => {
    const said = lint([CARD]).findings.map(({ id, message, fix }) => `${id}: ${message} ${fix}`);

    expect(said).toEqual([
      expect.stringMatching(
        /^1:2: No text style: ".*14px\/20px.*Inter.*"\. tokens_bind binds it to the token holding it, if one does; else give it a text style \(tokens_apply makes one\)\.$/,
      ),
      expect.stringMatching(/^1:3: No text style: /),
      '1:3: 68px wider than the room 1:1 "Card" gives it. Let it wrap (width fill, height auto), shorten it, or give its column more room.',
      "1:4: Places 2 children by hand; Figma reads them as display: flex; gap: 8px. Give it auto layout (design_apply with that display, gap and padding), so it resizes as the build will.",
      "1:1: Raw gap 16px. tokens_bind binds it to --space-4.",
      "1:1: Off the 4px grid: padding 13px. Round it to the scale, or snap it to a token with tokens_bind choose.",
      expect.stringMatching(
        /^1:8: Raw box-shadow: 0 4px 12px .+\. tokens_bind binds it to the token holding it, if one does; else make it an effect style with tokens_apply\.$/,
      ),
    ]);
  });

  // 0.7.0 fix 2026-10-18: a clipping frame cuts on purpose (a ticker's cards); only a text it cuts is lost content.
  it("leaves alone what a clipping frame cuts on purpose, a ticker's cards, but not a text it cuts", () => {
    const card = (id: string, x: number) => layer(id, "Card", { x, width: 160 });
    const row = (
      id: string,
      name: string,
      clipsContent: boolean,
      children: ReadLayer[],
    ) =>
      layer(id, name, { width: 300, layoutMode: "HORIZONTAL", itemSpacing: 12, clipsContent, children });
    const page = layer("3:0", "Page", {
      width: 300,
      height: 200,
      children: [
        row("3:1", "Ticker", true, [
          card("3:2", 0),
          card("3:3", 170),
          text("3:4", "Breaking news", { x: 340, width: 200 }),
        ]),
        row("3:5", "Row", false, [card("3:6", 0), card("3:7", 170)]),
      ],
    });

    expect(
      lint([modelOf(page)], { rules: ["overflow"] }).findings.map(({ id, message }) => `${id}: ${message}`),
    ).toEqual([
      '3:4: 240px wider than the room 3:1 "Ticker" gives it, which cuts it off.',
      '3:7: 30px wider than the room 3:5 "Row" gives it.',
    ]);
  });

  // K-032, live 2026-10-20: a layer put into a slot is plain (or extends the slot's id) and is the instance's own; the
  // slot's default content (I<instance>;<id in the component>) stays the component's.
  it("lints the layers put into an instance's slot, and leaves the slot's default content to its component", () => {
    const sheet = layer("5:1", "Sheet", {
      type: "INSTANCE",
      instance: { componentId: "C:sheet", componentName: "Sheet", properties: {} },
      children: [
        text("I5:1;2:3", "Title"),
        layer("I5:1;2:1", "Content", {
          type: "SLOT",
          children: [
            text("5:8", "Amount"),
            text("I5:1;2:1;5:9", "Total"),
            layer("I5:1;2:5", "Default", { children: [text("I5:1;2:6", "Default")] }),
          ],
        }),
      ],
    });

    expect(lint([modelOf(sheet)], { rules: ["text-style"] }).findings.map(({ id }) => id)).toEqual([
      "5:8",
      "I5:1;2:1;5:9",
    ]);
  });

  it("lists at most the limit, says more were left out, and still counts every rule", () => {
    const { findings, more, rules } = lint([CARD], { limit: 2 });

    expect(findings.map(({ id }) => id)).toEqual(["1:2", "1:3"]);
    expect(more).toBe(true);
    expect(rules).toHaveLength(6);
  });
});

describe("design_lint: what it could not read", () => {
  // K-033, B-008: an unread layer never passes for a clean one.
  it("starts the summary with the layers it could not read, and counts the rest", () => {
    const quiet = modelOf(layer("2:1", "Quiet"));

    expect(lint([quiet], {}, 1).summary).toBe(
      "Not checked: 1 of 2 layers could not be read (the notes say why). No findings in the rest for the rules checked.",
    );
    expect(lint([CARD], { rules: ["off-scale"] }, 2).summary).toBe(
      "Not checked: 2 of 3 layers could not be read (the notes say why). 1 findings in the rest: 0 errors, 0 warnings, 1 info.",
    );
  });
});
