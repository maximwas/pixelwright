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
import { clampUnit, decimal, roundTo } from "../numbers.ts";
import type { ColorSpace } from "./color-space.ts";

// The colour spaces CSS has, color() ones included: the plugin bundle carries none of culori's others.
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

const toRgb = converter("rgb");
const toP3 = converter("p3");

/** Channels as Figma and snapshots carry them, each from 0 to 1; alpha is 1 when left out. */
export interface Channels {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number | undefined;
}

/**
 * A colour on the wire (design_apply's and tokens_apply's plans): sRGB channels, or Display P3 ones when `space` says
 * so. The plugin turns it into the document's own space as it writes.
 */
export interface ColorValue {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
  readonly space?: "display-p3";
}

/** Whether a value is colour channels: three numbers r, g and b (Figma's colours, a variable's colour value). */
export function isChannels(value: unknown): value is Channels {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<Channels>).r === "number" &&
    typeof (value as Partial<Channels>).g === "number" &&
    typeof (value as Partial<Channels>).b === "number"
  );
}

/**
 * A colour in a colour space, immutable: read from Figma or CSS, converted between sRGB and Display P3, written as
 * CSS the way Dev Mode writes it, compared, and measured for contrast. Every reader and writer goes through it, so a
 * colour reads back as it was written.
 */
export class Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
  readonly space: ColorSpace;

  private constructor(channels: Channels, space: ColorSpace) {
    this.r = channels.r;
    this.g = channels.g;
    this.b = channels.b;
    this.alpha = channels.a ?? 1;
    this.space = space;
  }

  /** Figma's channels in the document's space (a Display P3 file holds P3 values). */
  static of(channels: Channels, space: ColorSpace = "srgb"): Color {
    return new Color(channels, space);
  }

  /** A colour from the wire, in the space it names. */
  static fromValue(value: ColorValue): Color {
    return new Color(value, value.space ?? "srgb");
  }

  /** Any CSS colour Figma can hold (hex, rgb(), hsl(), a name…) as sRGB; `color(display-p3 …)` stays in P3. */
  static parse(css: string): Color | null {
    const parsed = parse(css.trim());

    if (parsed === undefined) {
      return null;
    }

    const [channels, space] = parsed.mode === "p3" ? [parsed, "display-p3" as const] : [toRgb(parsed), "srgb" as const];

    return new Color(
      {
        r: clampUnit(channels.r),
        g: clampUnit(channels.g),
        b: clampUnit(channels.b),
        a: clampUnit(channels.alpha ?? 1),
      },
      space,
    );
  }

  /** This colour with its alpha multiplied by an opacity (a paint's or a layer's). */
  faded(opacity: number): Color {
    return new Color(
      {
        ...this.channels(),
        a: this.alpha * opacity,
      },
      this.space,
    );
  }

  /** This colour in another space: into Display P3 exactly, into sRGB clipped to what sRGB can show. */
  to(space: ColorSpace): Color {
    if (space === this.space) {
      return this;
    }

    const { r, g, b } =
      space === "srgb"
        ? clampRgb(
            toRgb({
              mode: "p3",
              r: this.r,
              g: this.g,
              b: this.b,
            }),
          )
        : toP3({
            mode: "rgb",
            r: this.r,
            g: this.g,
            b: this.b,
          });

    return new Color(
      {
        r: clampUnit(r),
        g: clampUnit(g),
        b: clampUnit(b),
        a: this.alpha,
      },
      space,
    );
  }

  /**
   * CSS as Dev Mode writes it: `#14161F`, `#000` when it shortens, `rgba()` when see-through; a Display P3 colour as
   * `color(display-p3 r g b)` with four decimals, `/ a` when see-through.
   */
  css(): string {
    if (this.space === "display-p3") {
      const channels = [this.r, this.g, this.b].map((channel) => String(roundTo(channel, 4)));

      return `color(display-p3 ${channels.join(" ")}${this.alpha < 1 ? ` / ${decimal(this.alpha)}` : ""})`;
    }

    if (this.alpha < 1) {
      const channels = [this.r, this.g, this.b].map((channel) => Math.round(channel * 255));

      return `rgba(${channels.join(", ")}, ${decimal(this.alpha)})`;
    }

    const pairs = [this.r, this.g, this.b].map(hexPair);
    const short = pairs.every((pair) => pair[0] === pair[1]);

    return `#${short ? pairs.map((pair) => pair[0]).join("") : pairs.join("")}`;
  }

  /** The sRGB form as `#RRGGBB`, never shortened, without alpha (DTCG's fallback for any colour). */
  hex(): string {
    const { r, g, b } = this.to("srgb");

    return `#${[r, g, b].map(hexPair).join("")}`;
  }

  /** The channels for Figma's API, alpha included. */
  channels(): { r: number; g: number; b: number; a: number } {
    return {
      r: this.r,
      g: this.g,
      b: this.b,
      a: this.alpha,
    };
  }

  /** The wire form: `space` only for a Display P3 colour. */
  value(): ColorValue {
    return {
      ...this.channels(),
      ...(this.space === "display-p3" ? { space: this.space } : {}),
    };
  }

  /** Whether another colour, taken into this colour's space, matches it channel by channel within `tolerance`. */
  equals(other: Color, tolerance: number): boolean {
    const theirs = other.to(this.space);
    const near = (mine: number, their: number) => Math.abs(mine - their) <= tolerance;

    return near(this.r, theirs.r) && near(this.g, theirs.g) && near(this.b, theirs.b) && near(this.alpha, theirs.alpha);
  }

  /** WCAG 2's relative luminance (culori's), of the sRGB form: WCAG defines it on sRGB. */
  luminance(): number {
    return wcagLuminance(this.#srgb());
  }

  /** WCAG 2's contrast ratio with another colour (culori's), 1 to 21, both in their sRGB forms. */
  contrast(other: Color): number {
    return wcagContrast(this.#srgb(), other.#srgb());
  }

  /** This colour as culori takes an sRGB one, clipped to what sRGB can show. */
  #srgb(): { mode: "rgb"; r: number; g: number; b: number } {
    const { r, g, b } = this.to("srgb");

    return {
      mode: "rgb",
      r,
      g,
      b,
    };
  }

  /** This colour laid over a backdrop at its alpha (source-over), in this colour's space. */
  over(backdrop: Color): Color {
    const bottom = backdrop.to(this.space);
    const mix = (top: number, under: number) => top * this.alpha + under * (1 - this.alpha);

    return new Color(
      {
        r: mix(this.r, bottom.r),
        g: mix(this.g, bottom.g),
        b: mix(this.b, bottom.b),
        a: bottom.alpha,
      },
      this.space,
    );
  }
}

/** A channel as two upper-case hex digits. */
function hexPair(channel: number): string {
  return Math.round(channel * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}
