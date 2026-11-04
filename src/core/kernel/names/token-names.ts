import { InjectionToken, injectable } from "@needle-di/core";
import { FNV, TOKEN_PATTERN, TOKEN_TEXT, TOKEN_VALUE } from "@/core/kernel/names/names.constants.ts";

/** A style as its name and its number among same-named styles of its kind (StyleNumbers). */
interface NamedStyle {
  readonly name: string;
  readonly duplicate?: number | undefined;
}

/** A variable as its name and the names its designer gave it per platform. */
interface NamedVariable {
  readonly name: string;
  readonly codeSyntax?: Readonly<Record<string, string>> | undefined;
}

/**
 * Token names as Dev Mode writes them (T-163, C-021): a style's or variable's CSS custom property, `a/b c` as `--a-b-c`.
 * Letters and digits of any script stay (CSS allows them); a name with none gets its FNV-1a hash (K-070), so no two
 * names share one. A variable's WEB code syntax wins over its name; a same-named style carries its number (`--Black-2`).
 */
@injectable()
export class TokenNames {
  token(name: string): string {
    const cleaned = name
      .trim()
      .replace(TOKEN_PATTERN.unnamed, TOKEN_VALUE.dash)
      .replace(TOKEN_PATTERN.edgeDashes, TOKEN_VALUE.none);

    return cleaned === TOKEN_VALUE.none ? TOKEN_TEXT.hashed(this.hash(name)) : TOKEN_TEXT.property(cleaned);
  }

  /** A style's custom property: its name's, numbered when other styles of its kind share the name (--Black-2). */
  style(style: NamedStyle): string {
    const name = this.token(style.name);

    return style.duplicate === undefined ? name : TOKEN_TEXT.numbered(name, style.duplicate);
  }

  /** A style's name as the XML writes it (textStyle): numbered like its token when another of its kind shares it (h1-2). */
  styleName(style: NamedStyle): string {
    return style.duplicate === undefined ? style.name : TOKEN_TEXT.numbered(style.name, style.duplicate);
  }

  /** A variable's custom property: the WEB code syntax its designer gave it, else its name. */
  variable(variable: NamedVariable): string {
    const web = variable.codeSyntax?.WEB?.trim() ?? TOKEN_VALUE.none;

    if (web === TOKEN_VALUE.none) {
      return this.token(variable.name);
    }

    return (
      TOKEN_PATTERN.wrapped.exec(web)?.[1] ?? (web.startsWith(TOKEN_VALUE.prefix) ? web : TOKEN_TEXT.property(web))
    );
  }

  /** The id of the variable an alias (`{ type: "VARIABLE_ALIAS", id }`) binds to field `key`, if any. */
  alias(bound: unknown, key: string): string | undefined {
    const alias: unknown = typeof bound === "object" && bound !== null ? Reflect.get(bound, key) : undefined;

    return typeof alias === "object" && alias !== null && "id" in alias && typeof alias.id === "string"
      ? alias.id
      : undefined;
  }

  /**
   * FNV-1a over code points, in base 36: short, stable, enough to keep a few odd names apart; the code base's one hash
   * (a vector's paths too, pathHash).
   */
  hash(text: string): string {
    let value: number = FNV.offset;

    for (const char of text) {
      value ^= char.codePointAt(0) ?? 0;
      value = Math.imul(value, FNV.prime) >>> 0;
    }

    return value.toString(FNV.radix);
  }
}

export const TOKEN_NAMES = new InjectionToken<TokenNames>("TokenNames");
