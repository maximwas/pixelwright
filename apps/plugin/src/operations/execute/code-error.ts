import { asyncHint } from "./async-hint.ts";

type AsyncBody = new (...names: string[]) => (...values: unknown[]) => Promise<unknown>;

/** The constructor of async functions: the code becomes the body of one. */
const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as AsyncBody;

/** Code that throws on its first line: its frame shows how the engine names the code's site and its first line. */
const PROBE = "throw new Error();";

/** The most frames of the code an error lists. */
const CODE_FRAMES = 5;

/** The longest line of the code an error quotes. */
const QUOTED_CHARS = 200;

/** One line of a stack: the function, the script it ran in and the place there. */
interface Frame {
  readonly name: string;
  readonly site: string;
  readonly line: number;
  readonly column: number | undefined;
}

/**
 * Code as the body of an async function given figma, console and pw. Every function comes from this one place, so
 * the frames of any code name the same site, and a probe's frame tells where the engine's wrapper puts the first line.
 */
export function codeFunction(code: string): (...values: unknown[]) => Promise<unknown> {
  return new AsyncFunction("figma", "console", "pw", code);
}

/**
 * What code threw, as its name and message, then the frames of the code itself (V8's or QuickJS's stack, its lines
 * read through a probe so they are the code's own, not the wrapper's), the line it threw on, and the async call to
 * make when Figma refused a synchronous one.
 */
export async function codeError(error: unknown, code: string): Promise<string> {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const thrown = `${error.name}: ${error.message}`;
  const probe = await probeFrame();
  const frames = probe === null ? [] : codeFrames(error.stack ?? "", probe);
  const first = frames[0];
  const quoted = first === undefined ? "" : (code.split("\n")[first.line - 1]?.trim().slice(0, QUOTED_CHARS) ?? "");
  const hint = asyncHint(error.message, quoted);

  return [
    thrown,
    ...frames.map(framed),
    ...(first === undefined ? [] : [`line ${first.line}: ${quoted}`]),
    ...(hint === null ? [] : [hint]),
  ].join("\n");
}

async function probeFrame(): Promise<Frame | null> {
  try {
    await codeFunction(PROBE)();
  } catch (error) {
    return error instanceof Error ? (frames(error.stack ?? "")[0] ?? null) : null;
  }

  return null;
}

/** The frames of an error's stack in the code, at the code's own lines and columns, the code's top level unnamed. */
export function codeFrames(stack: string, probe: Frame): Frame[] {
  return frames(stack)
    .filter((frame) => frame.site === probe.site)
    .slice(0, CODE_FRAMES)
    .map((frame) => ({
      ...frame,
      name: unasync(frame.name) === unasync(probe.name) ? "" : frame.name,
      // The engines start the body on a line of its own, so its columns are the code's; which token of a throwing
      // expression a column points at differs (V8 the probe's `new`, QuickJS its call), so the probe's column says
      // nothing of the wrapper.
      line: frame.line - probe.line + 1,
    }));
}

/** The stack's lines that name a place: `at name (site:line:column)` or `at site:line`; the rest (native) left out. */
function frames(stack: string): Frame[] {
  return stack.split("\n").flatMap((text) => {
    const match = /^\s*at (?:(.+?) \()?(.+?):(\d+)(?::(\d+))?\)?$/.exec(text);

    return match === null
      ? []
      : [
          {
            name: match[1] ?? "",
            site: match[2] ?? "",
            line: Number(match[3]),
            column: match[4] === undefined ? undefined : Number(match[4]),
          },
        ];
  });
}

function framed({ name, line, column }: Frame): string {
  const place = column === undefined ? `line ${line}` : `line ${line}, column ${column}`;

  return name === "" ? `    at ${place}` : `    at ${name} (${place})`;
}

function unasync(name: string): string {
  return name.replace(/^async /, "");
}
