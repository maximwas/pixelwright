/**
 * tokens_bind as clients list it (tools.json pins every word): 0.7.0's words, but the lint tool 0.9.0 does not register
 * is no longer named.
 */
export const TOKENS_BIND_TOOL = {
  name: "tokens_bind",
  title: "Bind raw values to tokens",
  description:
    "Binds the raw values under a layer, a page or the file to the styles and variables that hold them exactly, in each layer's variable mode and within the variables' scopes: colours to colour variables or paint styles, gaps, padding, radii, border widths and opacity to number variables, texts to text styles, shadows and blurs to effect styles. A value one token holds is bound; one several hold is listed with its candidates (pick with choose); one none holds is listed too, for tokens_apply. choose also snaps a near value to a token. remap rebinds every use of one token to another of its kind, for merging duplicates, and with instances: override inside instances too, as their overrides (a dark copy on a plan with one mode). Instances are left to their main components, all but what was put into their slots. Results are grouped by value. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun lists without writing).",
} as const;

export const TOKENS_BIND_FIELD = {
  within:
    'The layers to bind in: a layer id, a page id (all its layers), or "file". Default: the layers selected in Figma.',
  kinds:
    "What to bind: color (fills, strokes, text colours), number (gaps, padding, radii, border widths, opacity), text (text styles), effect (effect styles). Default: all.",
  choose:
    "Picks: for a value several tokens hold, the one it takes; or a value to snap to a token (a near colour, an off-scale gap), which then takes the token's value. Values as this tool lists them.",
  value: "The value as tokens_bind lists it: #3B2FD9, 16px, a font shorthand.",
  field: "Only where the value is this field (background, border, color, gap, padding, border-radius…).",
  remap:
    "Rebind every use of one token to another of its kind (--blue-500 to --brand, a duplicate style to the one kept); raw values are then left alone.",
  instances:
    "With remap: leave (default) keeps instances to their main components; override rebinds the uses inside them, nested instances too, as overrides on each instance, for a copy that must differ from its components (a dark copy in a file whose plan has one mode).",
} as const;

/** 0.7.0's caps on what a call names: a token, a value as listed, a field's CSS name, and picks in one call. */
export const TOKENS_BIND = { tokenChars: 300, valueChars: 500, fieldChars: 40, maxChoices: 200 } as const;

/** With remap: instances left to their main components, or their uses rebound as overrides. */
export const BIND_INSTANCES = { leave: "leave", override: "override" } as const;

export const TOKENS_BIND_TEXT = {
  /** Until the plugin binds, a real run says how to see what it would bind instead. */
  dryOnly:
    "tokens_bind finds raw values in this build and binds none yet: pass dryRun: true to see what it would bind.",
} as const;

/** tokens_bind's one-sentence answer (T-167): what it binds (or would), then what waits for a pick or has no token. */
export const TOKENS_BIND_SUMMARY = {
  bound: (dry: boolean, count: number) =>
    `${dry ? "Would bind" : "Bound"} ${count} raw value${count === 1 ? "" : "s"} to tokens`,
  rebound: (dry: boolean, count: number) => `${dry ? "Would rebind" : "Rebound"} ${count} use${count === 1 ? "" : "s"}`,
  on: (done: string, layers: number) => `${done} on ${layers} layer${layers === 1 ? "" : "s"}`,
  ambiguous: (count: number) => `${count} value${count === 1 ? " has" : "s have"} several tokens: pick with choose`,
  unmatched: (count: number) => `${count} value${count === 1 ? " has" : "s have"} no token`,
  errors: (count: number) => `${count} error${count === 1 ? "" : "s"}`,
  more: "time ran out before every layer: bind the rest with a narrower within",
  sentence: (parts: readonly string[]) => `${parts.join("; ")}.`,
} as const;
