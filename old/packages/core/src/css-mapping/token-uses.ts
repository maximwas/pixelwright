import type { FigmaProps, LengthValue, PaintSpec } from "./figma-props.ts";

/**
 * A token a change's properties name: where, and what it must be (a number, a paint, a shadow's colour variable, an
 * effect or a text style).
 */
export interface TokenUse {
  readonly key: keyof FigmaProps;
  readonly token: string;
  readonly kind: "FLOAT" | "PAINT" | "COLOR" | "EFFECT_STYLE" | "TEXT_STYLE";
}

const LENGTH_KEYS = [
  "itemSpacing",
  "counterAxisSpacing",
  "gridColumnGap",
  "gridRowGap",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
] as const;

/** Every token the properties name, in the order a dry run checks them: lengths, paints, then effect and text styles. */
export function tokenUsesOf(props: FigmaProps): TokenUse[] {
  const lengths = [
    ...LENGTH_KEYS.map((key) => [key, props[key]] as const),
    ...(props.padding ?? []).map((value) => ["padding", value] as const),
    ...(Array.isArray(props.cornerRadius) ? props.cornerRadius : [props.cornerRadius]).map(
      (value) => ["cornerRadius", value as LengthValue | undefined] as const,
    ),
  ];

  return [
    ...lengths.flatMap(([key, value]) =>
      typeof value === "object" && value !== null ? [use(key, value.token, "FLOAT")] : [],
    ),
    ...paintUses("fills", props.fills),
    ...paintUses("strokes", props.strokes?.paints),
    ...paintUses("textFills", props.textFills),
    ...styleUses(props),
  ];
}

function paintUses(key: keyof FigmaProps, specs: readonly PaintSpec[] | undefined): TokenUse[] {
  return (specs ?? []).flatMap((spec) => (spec.kind === "token" ? [use(key, spec.token, "PAINT")] : []));
}

function styleUses({ effects, textStyle }: FigmaProps): TokenUse[] {
  return [
    ...(Array.isArray(effects)
      ? effects.flatMap((effect) =>
          "token" in effect && effect.token !== undefined ? [use("effects", effect.token, "COLOR")] : [],
        )
      : []),
    ...(effects !== undefined && !Array.isArray(effects)
      ? [use("effects", (effects as { token: string }).token, "EFFECT_STYLE")]
      : []),
    ...(textStyle !== undefined && textStyle !== "" ? [use("textStyle", textStyle, "TEXT_STYLE")] : []),
  ];
}

function use(key: keyof FigmaProps, token: string, kind: TokenUse["kind"]): TokenUse {
  return {
    key,
    token,
    kind,
  };
}
