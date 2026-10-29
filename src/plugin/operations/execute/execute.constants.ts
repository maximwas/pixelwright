/** What execute keeps of what code prints and returns (P-162), each with its reason. */
export const CODE_OUTPUT = {
  /** The most console lines kept; the rest are counted, so a loop that logs cannot flood the answer. */
  maxLogs: 200,
  /** The longest console line kept. */
  logChars: 2_000,
  /** The longest result returned as JSON; a longer one comes back as its start, under the frame cap. */
  resultChars: 100_000,
  /** How deep a returned value is followed; deeper values come back as "[…]". */
  resultDepth: 8,
  /** The most frames of the code an error lists. */
  frames: 5,
  /** The longest line of the code an error quotes. */
  quotedChars: 200,
} as const;

/** The names the code's async function gives figma, console and pw. */
export const CODE_PARAMS = ["figma", "console", "pw"] as const;

/** Code that throws on its first line: its frame shows how the engine names the code's site and its first line. */
export const CODE_PROBE = "throw new Error();";

/** How long code may run on after its answer and still count as Pixelwright's and show busy (A§15.9, A§15.10). */
export const CODE_RUN = {
  /** Past this, code that never settles stops holding the window's busy line and the user's changes. */
  capMs: 10 * 60_000,
} as const;

/** What the op gives when the code's time is up first. */
export const TIMED_OUT = Symbol("timed out");

/** How a value prints (D-68): faithfully, undefined as undefined, a thrown object by its message. */
export const CODE_PRINT = {
  mixed: "mixed",
  circular: "[circular]",
  tooDeep: "[…]",
  null: "null",
  separator: " ",
  lineBreak: "\n",
  prefix: { log: "", info: "", debug: "", warn: "warn: ", error: "error: " },
  line: (prefix: string, text: string) => `${prefix}${text}`,
  dropped: (count: number) => `…and ${count} more lines`,
} as const;

/** How V8's and QuickJS's stack lines name a place: `at name (site:line:column)` or `at site:line`. */
export const CODE_STACK = { frame: /^\s*at (?:(.+?) \()?(.+?):(\d+)(?::(\d+))?\)?$/, asyncName: /^async / } as const;

export const CODE_TEXT = {
  ranPast: (ms: number) =>
    `The code ran past ${ms} ms: it may still be running, and what it changed so far stays (read the layers again).`,
  thrown: (name: string, message: string) => `${name}: ${message}`,
  place: (line: number, column: number | undefined) =>
    column === undefined ? `line ${line}` : `line ${line}, column ${column}`,
  at: (place: string) => `    at ${place}`,
  atNamed: (name: string, place: string) => `    at ${name} (${place})`,
  quoted: (line: number, text: string) => `line ${line}: ${text}`,
} as const;

/**
 * The synchronous Plugin API that throws under documentAccess "dynamic-page" (T-155, FX-007), by the name Figma's
 * error gives it, and the call to make instead (as @figma/plugin-typings deprecates them).
 */
export const ASYNC_FORMS: Readonly<Record<string, string>> = {
  getNodeById: "await figma.getNodeByIdAsync(id)",
  getStyleById: "await figma.getStyleByIdAsync(id)",
  currentPage: "await figma.setCurrentPageAsync(page)",
  getLocalPaintStyles: "await figma.getLocalPaintStylesAsync()",
  getLocalTextStyles: "await figma.getLocalTextStylesAsync()",
  getLocalEffectStyles: "await figma.getLocalEffectStylesAsync()",
  getLocalGridStyles: "await figma.getLocalGridStylesAsync()",
  getFileThumbnailNode: "await figma.getFileThumbnailNodeAsync()",
  getVariableById: "await figma.variables.getVariableByIdAsync(id)",
  getVariableCollectionById: "await figma.variables.getVariableCollectionByIdAsync(id)",
  getLocalVariables: "await figma.variables.getLocalVariablesAsync()",
  getLocalVariableCollections: "await figma.variables.getLocalVariableCollectionsAsync()",
  mainComponent: "await instance.getMainComponentAsync()",
  instances: "await component.getInstancesAsync()",
  consumers: "await style.getStyleConsumersAsync()",
  fillStyleId: "await node.setFillStyleIdAsync(id)",
  strokeStyleId: "await node.setStrokeStyleIdAsync(id)",
  effectStyleId: "await node.setEffectStyleIdAsync(id)",
  gridStyleId: "await node.setGridStyleIdAsync(id)",
  textStyleId: "await node.setTextStyleIdAsync(id)",
  setRangeTextStyleId: "await text.setRangeTextStyleIdAsync(start, end, id)",
  setRangeFillStyleId: "await text.setRangeFillStyleIdAsync(start, end, id)",
  vectorNetwork: "await node.setVectorNetworkAsync(network)",
  reactions: "await node.setReactionsAsync(reactions)",
};

export const ASYNC_HINT = {
  dynamicPage: "dynamic-page",
  asyncForm: "Async",
  word: (name: string) => new RegExp(`(?<![A-Za-z])${name}(?![A-Za-z])`),
  any: "This plugin's documentAccess is dynamic-page: call the Async form of what threw.",
  named: (form: string) => `Use ${form} instead: this plugin's documentAccess is dynamic-page.`,
} as const;
