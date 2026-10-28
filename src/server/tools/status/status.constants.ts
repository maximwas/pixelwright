/** status as clients list it (tools.json pins every word). */
export const STATUS_TOOL = {
  name: "status",
  title: "Connection status",
  description:
    "Lists the Figma files whose Pixelwright plugin is connected (name, current page, editor, whether Allow edits is on) and marks the active one: the file whose plugin window was in front last, which every tool uses when no file is named. Call it first, and whenever a tool says no file is connected: hint says what to do. While a plugin waits to be paired, pairing holds the code: tell the user to type it into the Pixelwright window, and never type or send it yourself. probe: true also pings the active file's plugin. key is the file key of figma.com links, given by Figma to private organization plugins only, so it is mostly null: then ask the user for the file's link.",
} as const;

/** The descriptions of status's fields that clients see in its schemas. */
export const STATUS_FIELD = {
  probe: "Also ping the active file's plugin and report the round trip.",
  key: "The file key of figma.com links; null when Figma gives none (see note).",
} as const;
