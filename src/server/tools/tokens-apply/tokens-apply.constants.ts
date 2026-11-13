/** tokens_apply as clients list it (tools.json pins every word): 0.7.0's words but where 0.9.0 takes tokens. */
export const TOKENS_APPLY_TOOL = {
  name: "tokens_apply",
  title: "Write design tokens",
  description:
    "Writes design tokens in the shape tokens_read returns with format json: tokens takes tokens_read's tokens as they are (their ids, aliasOf, defaultMode and selectors are read past), or the same shape by hand: collections with their modes and variables, each mode's value in CSS (a colour, px or a number, a quoted string, true/false, var(--token) for an alias), optionally scopes (where Figma's pickers offer it: a font weight or an opacity needs FONT_WEIGHT or OPACITY to stay a plain number) and codeSyntax per platform, and styles: paint (a colour or colour variable), text (the font shorthand, its letter spacing and case in also as tokens_read lists them, or after it: \"500 12px/16px 'Inter'; letter-spacing: 0.04em; text-transform: uppercase\"; left out, the style keeps its own) and effect (a box-shadow list, a shadow's colour a colour or var(--colour variable), its blurs after it or in also, or alone: \"backdrop-filter: blur(20px)\"; the effects a value leaves out, the style keeps). Collections, modes, variables and styles are found by name among the file's own or made (a style's token says which of styles sharing a name it is); what the file already holds, as tokens_read writes it, is left as it is, and nothing is deleted. A library's collection or style is never copied into the file: change it in the library. Send only what you change. errors name each variable, mode or style that could not be written while the rest goes in; notes, what was written but will not read back as given. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun checks without writing).",
} as const;

export const TOKENS_APPLY_FIELD = {
  tokens:
    "tokens_read's tokens (format json) as they are, or the same by hand: collections and styles, only what you change.",
} as const;
