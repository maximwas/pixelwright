/**
 * guide's topics in the order it lists them (T-210), each `topics/<name>.md`. 0.8.0 reads only (plan 5.0), so five with script:
 * write and layout come back with the write path, code-connect (D-36) and email (D-40) are gone.
 */
export const GUIDE_TOPIC = {
  workflow: "workflow",
  xml: "xml",
  tokens: "tokens",
  assets: "assets",
  script: "script",
} as const;

/** Each topic's one line, as the description and the index give it. */
export const GUIDE_TOPIC_ABOUT = {
  workflow:
    "Which tool to use when, from finding a section to its files, and how to read a design like a web developer.",
  xml: "The XML design_read returns: tags, metadata, CSS attributes and values, layout, read-only attributes.",
  tokens: "How tokens are named and read: styles, variables, modes, aliases, units, libraries.",
  assets: "What becomes a file, in which format, how files are named, and what no file holds (a video).",
  script: "An execute script over the reads: its limits, its utils, images and the answer types it reads by.",
} as const satisfies Record<(typeof GUIDE_TOPIC)[keyof typeof GUIDE_TOPIC], string>;

/** guide as clients list it (tools.json pins every word): the topics come from GUIDE_TOPIC_ABOUT. */
export const GUIDE_TOOL = {
  name: "guide",
  title: "Pixelwright guide",
  description: `How to work with Pixelwright and read what it returns. Without a topic: the topics. Topics: ${Object.entries(
    GUIDE_TOPIC_ABOUT,
  )
    .map(([topic, about]) => `${topic} (${about})`)
    .join("; ")}. Read workflow first in a new task, and xml before building from design_read.`,
} as const;

export const GUIDE_FIELD = { topic: "The topic to read. Default: the list of topics." } as const;

/** guide's answer without a topic: a line per topic, then how to read one. */
export const GUIDE_INDEX = {
  topic: "index",
  markdown: (topics: readonly { readonly name: string; readonly about: string }[]) =>
    `# Pixelwright guide\n\n${topics.map(({ name, about }) => `- ${name}: ${about}`).join("\n")}\n\nCall guide with a topic to read it.\n`,
} as const;
