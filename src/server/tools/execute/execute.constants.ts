import { EXECUTE } from "@/shared/ops/execute/execute.constants.ts";

const MS_PER_SECOND = 1_000;

/** execute as clients list it (tools.json pins every word): no `version` until save_version, no pw.paint or pw.variable. */
export const EXECUTE_TOOL = {
  name: "execute",
  title: "Run plugin code",
  description:
    'Runs JavaScript in the Pixelwright plugin to read the file, for what the read tools do not show: the code is the body of an async function given `figma` (the Plugin API, without clientStorage, ui, closePlugin and showUI), `console` and `pw`; `return` gives `result` (layers come back as {id, type, name}, figma.mixed as "mixed"), and what it logs comes back as `logs`. What it throws comes back as `error`, with the logs before it. `pw` stays between calls while the plugin window is open: pw.state for your data, your own functions added to pw, and Pixelwright\'s helpers: await pw.node(id) (the layer, or an error), await pw.fonts(layer) (loads every font its texts use, before you change them). The plugin runs with documentAccess "dynamic-page": use the Async calls (getNodeByIdAsync, getMainComponentAsync, getLocalPaintStylesAsync, setFillStyleIdAsync…), and await page.loadAsync() before reading another page. figma.skipInvisibleInstanceChildren is Figma\'s own, false in the editor and true in Dev Mode: set to true, findAll, findOne and children skip hidden layers inside instances and getNodeByIdAsync gives null for them (it is set back after the call). Keep a long script in a file and pass its path as script: it is read at every call, so after a plugin restart or a change to the file run it again rather than calling the functions it once added to pw. What it changes during the call is one undo step in Figma. Refused while the plugin\'s Allow edits switch is off, but code it starts that outlives the call (timers, listeners, work past the timeout) keeps running until the plugin window is closed, the switch notwithstanding. timeout waits up to 300 s for a long task; an endless loop, synchronous or of awaits, freezes Figma until the plugin is closed. This version reads only: if the user explicitly asks to change the file, warn that editing is not supported or stable in this version, and write only once the user says to go on; the Allow edits switch still gates every write. Before code, try the read tools (design_read, inspect, measure, nodes_find): they need no code and work with Allow edits off; code in which nothing writes (no property set, no create*, remove, set*… call, no helper of your own) is told so in `note`.',
} as const;

export const EXECUTE_FIELD = {
  code: "JavaScript run as the body of an async function with `figma` (the Plugin API) and `console`: `await` works, `return` gives the result. Give code or script.",
  script:
    "A file of such code on the server's disk, run instead of code. It is read at every call, so the file as it is now runs, after a plugin restart too. A relative path starts in the project folder: the MCP client's root, else CLAUDE_PROJECT_DIR, else the server's working directory.",
  timeout: "Seconds to wait for the code: 10 by default, up to 300 for a long task.",
  note: "When the code ran and only reads (nothing in it writes): the tools that read without code.",
} as const;

/** The call's timeout in seconds, as the tool takes it: the op's bounds in ms. */
export const EXECUTE_SECONDS = {
  perSecond: MS_PER_SECOND,
  min: 1,
  max: EXECUTE.maxMs / MS_PER_SECOND,
  default: EXECUTE.defaultMs / MS_PER_SECOND,
} as const;

/** A script file (T-151): its path's bound, how it is read, and that a character is at most 4 bytes in UTF-8. */
export const EXECUTE_SCRIPT = { pathChars: 1_024, encoding: "utf8", maxBytesPerChar: 4 } as const;

export const EXECUTE_TEXT = {
  oneOf: "Give code or script, one of them: the code itself, or the path of a file with it.",
  notAFile: (script: string, path: string) => `${script} is not a file the server can read (${path}).`,
  tooBig: (script: string, bytes: number) =>
    `${script} is ${bytes} bytes: execute runs at most ${EXECUTE.codeChars} characters.`,
  wrongLength: (script: string, chars: number) =>
    `${script} is ${chars} characters: execute runs 1 to ${EXECUTE.codeChars} characters.`,
  /** It speaks of the code, never of the file (D-38). */
  readsOnly:
    "This code only reads: design_read, inspect, measure and nodes_find read without code, and work while Allow edits is off.",
} as const;

/** The code as the plugin runs it: the body of an async function given figma, console and pw, from the second line. */
export const CODE_WRAPPER = {
  wrapped: (code: string) => `(async function (figma, console, pw) {\n${code}\n})`,
  /** The wrapper's lines before the code's first. */
  linesBefore: 1,
} as const;

/** The syntax check's words (T-152) and how it reads Node's SyntaxError stack: `execute:3`, the line, the caret. */
export const SYNTAX = {
  scriptName: "execute",
  header: /^execute:(\d+)$/,
  caret: /^\s*\^+$/,
  caretMark: "^",
  lineBreak: "\n",
  /** The longest line of the code an error quotes. */
  quotedChars: 200,
  thrown: (name: string, message: string) => `${name}: ${message}`,
  at: (line: number, column: number | null) => `    at line ${line}${column === null ? "" : `, column ${column}`}`,
  quoted: (line: number, text: string) => `line ${line}: ${text}`,
  atEnd: "    at the end of the code",
  cut: (chars: number) =>
    `The code ends there, after ${chars} characters: if you sent more, the rest was cut on its way to Pixelwright (a model's reply is limited in tokens). Keep long code or data in a file and pass its path as script.`,
} as const;

/**
 * The signs of a write the reads-only check looks for (T-153, D-38), from 0.7.0. Figma's methods that change a file,
 * by how their names start (createRectangle, setPluginData, addMode).
 */
export const WRITE_PREFIX =
  /^(?:add|append|apply|clear|clone|create|define|delete|detach|edit|extend|import|insert|lock|move|remove|rename|reorder|reset|resize|save|set|swap|unlock)[A-Z]/;

/**
 * Methods that change a file by their whole names (Figma's), write into an object (Object.assign), or run a function
 * the code holds under another name (call, apply, bind, a function's constructor). Map and Set's set, add, delete and
 * clear are not among them: counting with a Map keeps the note.
 */
export const WRITE_NAMES = [
  "apply",
  "assign",
  "bind",
  "call",
  "clone",
  "combineAsVariants",
  "commitUndo",
  "constructor",
  "exclude",
  "extend",
  "flatten",
  "group",
  "intersect",
  "outlineStroke",
  "remove",
  "rescale",
  "resize",
  "smartResize",
  "subtract",
  "transformGroup",
  "triggerUndo",
  "ungroup",
  "union",
] as const;

/** Names that run code the code does not show, or reach the global object where earlier calls may have left some. */
export const HIDDEN_CODE = ["eval", "Function", "Reflect", "globalThis", "self", "window"] as const;

/** Pixelwright's helpers on pw that only read; anything else there is a function an earlier call left, unseen. */
export const PW_READS = ["node", "fonts", "paint", "variable"] as const;

/** The AST's node and pattern types the check reads, as acorn names them. */
export const AST = {
  identifier: "Identifier",
  privateIdentifier: "PrivateIdentifier",
  literal: "Literal",
  member: "MemberExpression",
  call: "CallExpression",
  newCall: "NewExpression",
  objectPattern: "ObjectPattern",
  property: "Property",
  unary: "UnaryExpression",
  assignment: "AssignmentExpression",
  assignmentPattern: "AssignmentPattern",
  forIn: "ForInStatement",
  forOf: "ForOfStatement",
  variablePattern: "VariablePattern",
  pw: "pw",
  deleteOperator: "delete",
  ecmaVersion: "latest",
} as const;

/** Syntax that may write unseen: `this` (the global object), `with`, an import. */
export const HIDDEN_SYNTAX = ["ThisExpression", "WithStatement", "ImportExpression"] as const;

/** Where a property written to sits: counted up, or in a pattern that assigns into it. */
export const WRITTEN_IN = ["UpdateExpression", "ArrayPattern", "ObjectPattern", "RestElement"] as const;
