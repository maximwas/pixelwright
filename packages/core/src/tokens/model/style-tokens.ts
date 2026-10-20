import { shadowListCss } from "../../css-mapping/groups/effects.ts";
import { textStyleExtras } from "../../css-mapping/groups/text/styles.ts";
import { fontShorthand } from "../../css-mapping/values/fonts.ts";
import { gradientCss } from "../../css-mapping/values/gradient-css.ts";
import { Color } from "../../kernel/color/color.ts";
import type { ColorSpace } from "../../kernel/color/color-space.ts";
import { styleTokenName } from "../../kernel/names.ts";
import type { Notes } from "../notes.ts";
import type { RawStyle } from "../raw-tokens.ts";
import type { StyleToken, StyleTokens } from "./types.ts";

/** What writing a style needs: the file's colour space, the notes, and the variables' tokens by id. */
interface StyleContext {
  readonly space: ColorSpace;
  readonly notes: Notes;
  readonly names?: ReadonlyMap<string, string>;
}

/** Writes one kind of style as a token, or notes why it cannot. */
type StyleWriter = (style: RawStyle, token: string, context: StyleContext) => StyleToken | null;

/** A writer per style type, with the group of tokens it fills; grid styles never reach code. */
const STYLE_WRITERS: ReadonlyMap<string, { kind: keyof StyleTokens; write: StyleWriter }> = new Map([
  [
    "PAINT",
    {
      kind: "paint",
      write: paintToken,
    },
  ],
  [
    "TEXT",
    {
      kind: "text",
      write: textToken,
    },
  ],
  [
    "EFFECT",
    {
      kind: "effect",
      write: effectToken,
    },
  ],
] as const);

/** The order notes about same-named styles come in. */
const NOTED_KINDS = [
  ["Paint", "paint"],
  ["Effect", "effect"],
  ["Text", "text"],
] as const;

/**
 * The paint, text and effect styles as tokens, named the way design_read names them (--Black-2 for the second style
 * named Black). Same-named styles with different values are noted, so the numbers are not a surprise.
 */
export function styleTokens(styles: readonly RawStyle[], context: StyleContext): StyleTokens {
  const tokens: StyleTokens = {
    paint: [],
    text: [],
    effect: [],
  };

  for (const style of styles) {
    const writer = STYLE_WRITERS.get(style.type);
    const token = writer?.write(style, styleTokenName(style), context) ?? null;

    if (writer !== undefined && token !== null) {
      tokens[writer.kind].push(token);
    }
  }

  for (const [label, kind] of NOTED_KINDS) {
    noteSameNames(label, tokens[kind], context.notes);
  }

  return tokens;
}

/**
 * A single solid paint as its colour; a gradient or layered one as the CSS Figma wrote for a layer that uses it, else
 * a lone gradient as core writes it.
 */
function paintToken(style: RawStyle, token: string, context: StyleContext): StyleToken | null {
  const visible = (style.paints ?? []).filter((paint) => paint.visible ?? true);
  const [only] = visible;

  if (visible.length === 1 && only?.type === "SOLID" && only.color !== undefined) {
    return {
      name: style.name,
      token,
      value: Color.of(only.color, context.space)
        .faded(only.opacity ?? 1)
        .css(),
    };
  }

  if (style.css !== undefined) {
    return {
      name: style.name,
      token,
      value: style.css,
    };
  }

  // A style has no box: its gradient reads as on a square, the shape its transform is kept in.
  const gradient =
    visible.length === 1 && only !== undefined
      ? gradientCss(
          only,
          {
            width: 1,
            height: 1,
          },
          { colorSpace: context.space },
        )
      : null;

  if (gradient !== null) {
    return {
      name: style.name,
      token,
      value: gradient,
    };
  }

  const kinds = visible.map((paint) => paint.type.toLowerCase()).join(" + ") || "empty";

  context.notes.add(
    `Paint style ${style.name} is ${kinds}: CSS for it comes from a layer that uses it, and none read here does (an image has none).`,
  );

  return null;
}

/** The font shorthand as --<name>-font, its letter spacing and case as tokens of their own when not the default. */
function textToken(style: RawStyle, token: string): StyleToken | null {
  const { fontName, fontSize, lineHeight } = style;

  if (fontName === undefined || fontSize === undefined || lineHeight === undefined) {
    return null;
  }

  const also = textStyleExtras(style).map(([property, value]) => ({
    token: `${token}-${property}`,
    value,
  }));

  return {
    name: style.name,
    token: `${token}-font`,
    value: fontShorthand({
      fontName,
      fontSize,
      lineHeight,
    }),
    ...(also.length === 0 ? {} : { also }),
  };
}

/** The shadows as a box-shadow list, a colour bound to a variable as its var(); blurs are not tokens yet. */
function effectToken(style: RawStyle, token: string, context: StyleContext): StyleToken | null {
  const shadows = shadowListCss(style.effects ?? [], context.space, context.names);

  if (shadows === "") {
    context.notes.add(`Effect style ${style.name} holds no shadow: blurs are not tokens yet.`);

    return null;
  }

  return {
    name: style.name,
    token,
    value: shadows,
  };
}

function noteSameNames(label: string, tokens: readonly StyleToken[], notes: Notes): void {
  for (const [name, group] of Map.groupBy(tokens, (token) => token.name)) {
    if (group.length > 1) {
      notes.add(
        `${label} styles named ${name} are ${group.length} different styles: ${group.map(({ token, value }) => `${token} ${value}`).join(", ")}.`,
      );
    }
  }
}
