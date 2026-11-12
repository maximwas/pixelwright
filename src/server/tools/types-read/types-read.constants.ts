/** types_read as clients list it (tools.json pins every word). */
export const TYPES_READ_TOOL = {
  name: "types_read",
  title: "Read answer types",
  description:
    "Gives the whole answer type of each named read as TypeScript, every field at every level with its comment, from the tool's own output schema: read it before an execute script uses an answer, since a script that reads a key the type lacks throws. Name a tool as this list does (nodes_find) or as a script calls it (nodesFind, pw.nodesFind); names that are no read come back in unknown.",
} as const;

export const TYPES_READ_FIELD = {
  tools: "The reads to describe, e.g. nodes_find, inspect, design_read.",
  types: "One per read named, in the order asked: its tool's name, how a script calls it, and its answer type.",
  unknown: "The names asked that are no read a script can call.",
} as const;

/** One call's names: more than there are reads, each longer than any tool's name. */
export const TYPES_READ = { maxTools: 40, nameChars: 64 } as const;
