/** The colour spaces Figma files hold colours in: sRGB, or Display P3 (a DISPLAY_P3 file's channels are P3 values). */
export const COLOR_SPACE = { srgb: "srgb", displayP3: "display-p3" } as const;

/** culori's names of the two spaces a colour is kept in. */
export const CULORI_MODE = { rgb: "rgb", p3: "p3" } as const;

export const COLOR_NUMBER = {
  /**
   * How far two channels may differ and still be one colour (K-064): a colour converted between sRGB and P3 and back
   * lands within it, and an 8-bit step (0.0039) does not.
   */
  epsilon: 0.0005,
  /** An 8-bit channel's top value: rgba() and hex write channels as 0-255. */
  byte: 255,
  hexRadix: 16,
  hexDigits: 2,
  opaque: 1,
} as const;

export const COLOR_VALUE = { channelJoint: ", ", p3Joint: " ", hexPad: "0", none: "" } as const;

export const COLOR_TEXT = {
  hex: (pairs: string) => `#${pairs}`,
  rgba: (channels: string, alpha: number) => `rgba(${channels}, ${alpha})`,
  p3: (channels: string, alpha: string) => `color(display-p3 ${channels}${alpha})`,
  p3Alpha: (alpha: number) => ` / ${alpha}`,
} as const;
