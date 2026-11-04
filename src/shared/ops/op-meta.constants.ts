/**
 * When an op runs beside the others (P-021): `free` at once (ping, changes, upload, selection_wait); `read` after the
 * writes before it and beside other reads; `write` after everything before it, alone. A read must never see a write
 * half done (B-051).
 */
export const OP_TURN = { free: "free", read: "read", write: "write" } as const;

/** Every op's name: the catalog's keys and the `run` call's first argument. */
export const OP_NAME = {
  ping: "ping",
  selection: "selection",
  changes: "changes",
  execute: "execute",
  show: "show",
  viewport: "viewport",
  selectionWait: "selection_wait",
  outline: "outline",
  fileMap: "file_map",
  find: "find",
  read: "read",
  nearby: "nearby",
  export: "export",
  chunk: "chunk",
  cover: "cover",
  image: "image",
  inspect: "inspect",
  setOf: "set_of",
  screens: "screens",
  flows: "flows",
  components: "components",
  variables: "variables",
  usage: "usage",
} as const;
