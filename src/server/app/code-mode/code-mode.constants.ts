const MS_PER_SECOND = 1_000;

const MIB = 1024 * 1024;
/** The logs' last characters a run answers, and all the sandbox keeps of them while the code runs. */
const LOG_CHARS = 4_000;

/** A run's limits (research §6), to tune by the measurement. */
export const CODE_LIMITS = {
  /** A run's wall time by default: 30 s, since many clients time a request out at 60 s; each pw call gets what is left of it. */
  timeoutMs: 30_000,
  /** The longest a run may ask for: classic execute's own ceiling. */
  maxTimeoutMs: 300_000,
  perSecond: MS_PER_SECOND,
  sandbox: {
    /** Room for a few design reads held at once; QuickJS stops the code past it. */
    memoryBytes: 64 * MIB,
    /**
     * 256 KB, not research §6's 1 MB: QuickJS's frames also sit on Node's own stack, and a guest recursing past 512 KB
     * overflowed it and threw in the server (measured 2026-11-11 on Node 26).
     */
    stackBytes: 256 * 1024,
    /**
     * Guest CPU between two pauses (a pw call, the end): QuickJS runs on Node's event loop, so a slice holds every
     * other MCP call and a run's own timeout; the code only filters, so 1 s of it is an endless loop.
     */
    cpuSliceMs: 1_000,
    logChars: LOG_CHARS,
  },
  /** pw calls a run may make: past them, the filter belongs inside one call, or the work in more runs. */
  calls: 50,
  /** pw calls at once: the plugin queues reads anyway, and four keep one run from crowding out other calls. */
  inFlight: 4,
  /** What reaches the model of the result: Cloudflare's cap, about 6k tokens. */
  resultChars: 24_000,
  logChars: LOG_CHARS,
  /** Images shown after the answer; a run's other handles are named, not sent. */
  images: 4,
} as const;

export const CODE_TEXT = {
  /** The argument that names the file a tool reads. */
  file: "file",
  call: (name: string) => `pw.${name}`,
  handle: (index: number) => `image-${index}`,
  tooManyCalls: (name: string) =>
    `pw.${name}: a run makes at most ${CODE_LIMITS.calls} pw calls: filter inside one call, or split the work into runs.`,
  timedOut: (ms: number) =>
    `The run took longer than ${ms / MS_PER_SECOND} s: give execute a longer timeout, or split the work into runs.`,
  cancelled: "The run was cancelled.",
  /** The run's signal once it answered: its calls still pending stop at their next plugin round, queued ones at once. */
  ended: "The run ended.",
  failed: (name: string, text: string) => `pw.${name}: ${text}`,
  issue: (path: string, message: string) => `${path === "" ? "args" : path}: ${message}`,
  unrecognized: (keys: readonly string[]) => `Unrecognized key: ${keys.map((key) => JSON.stringify(key)).join(", ")}`,
  /** What a refusal of a key adds: the keys the function takes, so the model fixes its call in the same turn. */
  accepted: (refused: string, keys: readonly string[]) => `${refused} (accepted: ${keys.join(", ")})`,
  expected: (type: string) => `Invalid input: expected ${type}`,
  issueSeparator: "; ",
  pathSeparator: ".",
  lineBreak: "\n",
  unknown: (name: string) => `pw.${name} is not a function of this server.`,
  abortEvent: "abort",
} as const;

export const CODE_LOG = { run: "code run" } as const;

/** The zod issues of a number past its bound, which the bridge clamps (code arm only); every other one refuses. */
export const BOUND_ISSUE = { tooBig: "too_big", tooSmall: "too_small", origins: ["number", "int"] } as const;

/** The structural cut's markers, and how it searches for the largest cut that fits. */
export const CUT = {
  /** Halvings of the scale: 2^-12 of the longest list and text is finer than any cap needs. */
  rounds: 12,
  /** A text is never cut shorter than this. */
  minChars: 20,
  /** Room the marker in front of the logs kept takes. */
  markerChars: 40,
  items: (count: number) => `--- TRUNCATED: ${count} more items ---`,
  chars: (count: number) => `--- TRUNCATED: ${count} more characters ---`,
  lines: (count: number) => `--- TRUNCATED: ${count} earlier lines ---`,
  /** In front of the end kept of a log line too long to fit. */
  tail: "…",
} as const;

/**
 * How a script's answer shapes read a tool's outputSchema: as zod's JSON Schema of its output (tools/list publishes the
 * same), and a $ref's JSON Pointer within it ("#", "#/$defs/name").
 */
export const SHAPE_SCHEMA = {
  options: { target: "draft-2020-12", io: "output", unrepresentable: "any" },
  root: "#",
  pointerStart: 2,
  separator: "/",
} as const;
