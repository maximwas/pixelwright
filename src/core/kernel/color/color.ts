import {
  clampRgb,
  converter,
  modeA98,
  modeHsl,
  modeHwb,
  modeLab,
  modeLch,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeP3,
  modeProphoto,
  modeRec2020,
  modeRgb,
  modeXyz50,
  modeXyz65,
  parse,
  useMode,
  wcagContrast,
  wcagLuminance,
} from "culori/fn";
import {
  COLOR_NUMBER,
  COLOR_SPACE,
  COLOR_TEXT,
  COLOR_VALUE,
  CULORI_MODE,
} from "@/core/kernel/color/color.constants.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { PRECISION } from "@/core/kernel/numbers/precision.constants.ts";

// The colour spaces CSS has, color() ones included: culori/fn registers none, so the plugin bundle carries only these.
for (const mode of [
  modeRgb,
  modeHsl,
  modeHwb,
  modeLab,
  modeLch,
  modeOklab,
  modeOklch,
  modeP3,
  modeLrgb,
  modeA98,
  modeProphoto,
  modeRec2020,
  modeXyz50,
  modeXyz65,
]) {
  useMode(mode);
}

const toRgb = converter(CULORI_MODE.rgb);
const toP3 = converter(CULORI_MODE.p3);

export type ColorSpace = (typeof COLOR_SPACE)[keyof typeof COLOR_SPACE];

/** Channels as Figma and the read model carry them, each from 0 to 1; alpha is 1 when left out. */
export interface Channels {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number | undefined;
}

/**
 * A colour on the wire (K-064): sRGB channels, or Display P3 ones when `space` says so. The plugin turns it into the
 * document's own space as it writes.
 */
export interface ColorValue {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  readonly space?: typeof COLOR_SPACE.displayP3;
}

/**
 * A colour in a colour space, immutable (K-063): read from Figma or CSS, converted between sRGB and Display P3,
 * written as CSS the way Dev Mode writes it, compared, and measured for contrast. Every reader and writer goes through
 * it, so a colour reads back as it was written.
 */
export class Color {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
  readonly space: ColorSpace;
  readonly #format = new NumberFormat();

  private constructor(channels: Channels, space: ColorSpace) {
    this.red = channels.r;
    this.green = channels.g;
    this.blue = channels.b;
    this.alpha = channels.a ?? COLOR_NUMBER.opaque;
    this.space = space;
  }

  /** Figma's channels in the document's space (a Display P3 file holds P3 values). */
  static of(channels: Channels, space: ColorSpace = COLOR_SPACE.srgb): Color {
    return new Color(channels, space);
  }

  /**
   * Any CSS colour (hex, rgb(), hsl(), a name, color() …) as sRGB, clamped; `color(display-p3 …)` stays in P3. Null
   * for what is no colour, and for a `none` channel (O-018), which Figma has no value for.
   */
  static parse(css: string): Color | null {
    const parsed = parse(css.trim());

    if (parsed === undefined) {
      return null;
    }

    const isP3 = parsed.mode === CULORI_MODE.p3;
    const channels = isP3 ? parsed : toRgb(parsed);
    const { r, g, b } = channels;

    if (![r, g, b].every((channel) => Number.isFinite(channel))) {
      return null;
    }

    const clamp = (channel: number) => Math.min(1, Math.max(0, channel));

    return new Color(
      { r: clamp(r), g: clamp(g), b: clamp(b), a: clamp(channels.alpha ?? COLOR_NUMBER.opaque) },
      isP3 ? COLOR_SPACE.displayP3 : COLOR_SPACE.srgb,
    );
  }

  /** This colour with its alpha multiplied by an opacity (a paint's or a layer's). */
  faded(opacity: number): Color {
    return new Color({ ...this.channels(), a: this.alpha * opacity }, this.space);
  }

  /** This colour in another space: into Display P3 exactly, into sRGB clipped to what sRGB can show. */
  to(space: ColorSpace): Color {
    if (space === this.space) {
      return this;
    }

    const { r, g, b } =
      space === COLOR_SPACE.srgb
        ? clampRgb(toRgb({ mode: CULORI_MODE.p3, r: this.red, g: this.green, b: this.blue }))
        : toP3({ mode: CULORI_MODE.rgb, r: this.red, g: this.green, b: this.blue });

    return new Color({ r, g, b, a: this.alpha }, space);
  }

  /**
   * CSS as Dev Mode writes it (C-1.7): `#14161F`, `#000` when it shortens, `rgba()` with a 2-decimal alpha when
   * see-through; a Display P3 colour as `color(display-p3 r g b)` with 4 decimals, `/ a` when see-through.
   */
  css(): string {
    const seeThrough = this.alpha < COLOR_NUMBER.opaque;
    const alpha = this.#format.round(this.alpha, PRECISION.alpha);

    if (this.space === COLOR_SPACE.displayP3) {
      const channels = this.#rgb().map((channel) => this.#format.round(channel, PRECISION.p3Channel));

      return COLOR_TEXT.p3(
        channels.join(COLOR_VALUE.p3Joint),
        seeThrough ? COLOR_TEXT.p3Alpha(alpha) : COLOR_VALUE.none,
      );
    }

    if (seeThrough) {
      return COLOR_TEXT.rgba(
        this.#rgb()
          .map((channel) => this.#byte(channel))
          .join(COLOR_VALUE.channelJoint),
        alpha,
      );
    }

    const pairs = this.#rgb().map((channel) => this.#hexPair(channel));
    const short = pairs.every(([high, low]) => high === low);

    return COLOR_TEXT.hex(short ? pairs.map(([high]) => high).join(COLOR_VALUE.none) : pairs.join(COLOR_VALUE.none));
  }

  /** The sRGB form as `#RRGGBB`, never shortened, without alpha (DTCG's fallback for any colour). */
  hex(): string {
    return COLOR_TEXT.hex(
      this.to(COLOR_SPACE.srgb)
        .#rgb()
        .map((channel) => this.#hexPair(channel))
        .join(COLOR_VALUE.none),
    );
  }

  /** The channels for Figma's API, alpha included. */
  channels(): { r: number; g: number; b: number; a: number } {
    return { r: this.red, g: this.green, b: this.blue, a: this.alpha };
  }

  /** The wire form (K-064): `space` only for a Display P3 colour. */
  value(): ColorValue {
    return { ...this.channels(), ...(this.space === COLOR_SPACE.displayP3 ? { space: this.space } : {}) };
  }

  /** Whether another colour, taken into this colour's space, matches it channel by channel within `tolerance`. */
  equals(other: Color, tolerance: number = COLOR_NUMBER.epsilon): boolean {
    const theirs = other.to(this.space);
    const near = (mine: number, their: number) => Math.abs(mine - their) <= tolerance;

    return (
      near(this.red, theirs.red) &&
      near(this.green, theirs.green) &&
      near(this.blue, theirs.blue) &&
      near(this.alpha, theirs.alpha)
    );
  }

  /** WCAG 2's relative luminance (culori's), of the sRGB form: WCAG defines it on sRGB. */
  luminance(): number {
    return wcagLuminance(this.#srgb());
  }

  /** WCAG 2's contrast ratio with another colour (culori's), 1 to 21, both in their sRGB forms. */
  contrast(other: Color): number {
    return wcagContrast(this.#srgb(), other.#srgb());
  }

  /** This colour laid over a backdrop at its alpha (source-over), in this colour's space. */
  over(backdrop: Color): Color {
    const bottom = backdrop.to(this.space);
    const mix = (top: number, under: number) => top * this.alpha + under * (1 - this.alpha);

    return new Color(
      {
        r: mix(this.red, bottom.red),
        g: mix(this.green, bottom.green),
        b: mix(this.blue, bottom.blue),
        a: bottom.alpha,
      },
      this.space,
    );
  }

  /** This colour as culori takes an sRGB one, clipped to what sRGB can show. */
  #srgb(): { mode: typeof CULORI_MODE.rgb; r: number; g: number; b: number } {
    const srgb = this.to(COLOR_SPACE.srgb);

    return { mode: CULORI_MODE.rgb, r: srgb.red, g: srgb.green, b: srgb.blue };
  }

  #rgb(): number[] {
    return [this.red, this.green, this.blue];
  }

  #byte(channel: number): number {
    return Math.round(channel * COLOR_NUMBER.byte);
  }

  /** A channel as two upper-case hex digits. */
  #hexPair(channel: number): string {
    return this.#byte(channel)
      .toString(COLOR_NUMBER.hexRadix)
      .padStart(COLOR_NUMBER.hexDigits, COLOR_VALUE.hexPad)
      .toUpperCase();
  }
}
