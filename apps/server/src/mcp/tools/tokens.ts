import type { McpServer } from "@modelcontextprotocol/server";
import { type RawTokens, tokenModel, tokensCss, tokensPlan } from "@pixelwright/core";
import type * as z from "zod";
import { MAX_LIBRARY_VARIABLES, READ_ONLY_ANNOTATIONS, WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import {
  TokensApplyOutputSchema,
  TokensApplyToolInputSchema,
  TokensReadInputSchema,
  TokensReadOutputSchema,
} from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";
import { runOp } from "../run-op.ts";

type TokensReadArgs = z.output<typeof TokensReadInputSchema>;
type TokensRead = z.input<typeof TokensReadOutputSchema>;
type TokensApplyArgs = z.output<typeof TokensApplyToolInputSchema>;
type TokensApplied = z.input<typeof TokensApplyOutputSchema>;

export function registerTokensTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "tokens_read",
    title: "Read the design tokens",
    description:
      "Reads the file's design tokens: every variable collection with all its modes (light, dark…), and the paint, text and effect styles, its own and those the current page uses from a team library, named the way design_read writes them (var(--Name)). format css (default) returns ready CSS: :root holds each collection's default mode and the styles, and every other mode is a block [data-<collection>=\"<mode>\"] to put on the element a theme applies to; format json returns the same per collection and mode. libraries: true also lists the enabled libraries' variables by name. notes say what could not be written.",
    input: TokensReadInputSchema,
    output: TokensReadOutputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    run: (args) => readTokens(bridge, args),
  });
  registerTool(server, {
    name: "tokens_apply",
    title: "Write design tokens",
    description:
      "Writes design tokens in the shape tokens_read returns with format json: collections with their modes and variables, each mode's value in CSS (a colour, px or a number, a quoted string, true/false, var(--token) for an alias). Collections, modes and variables are found by name in the file's own collections or made; a value the variable already holds is left as it is, and nothing is deleted. A library's collection is never copied into the file: change it in the library. Send only what you change. errors name each variable and mode that could not be written while the rest goes in. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun checks without writing).",
    input: TokensApplyToolInputSchema,
    output: TokensApplyOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => applyTokens(bridge, args),
  });
}

/** tokens_apply: the values read in core, written by the plugin; what core could not read comes first among errors. */
export async function applyTokens(
  bridge: ToolContext["bridge"],
  { dryRun, file, ...input }: TokensApplyArgs,
): Promise<TokensApplied> {
  const { plan, errors } = tokensPlan(input);
  const applied = await runOp(
    bridge,
    "tokens_apply",
    {
      plan,
      dryRun,
    },
    file,
  );

  return {
    ...applied,
    errors: [...errors, ...applied.errors],
    dryRun,
  };
}

export async function readTokens(
  bridge: ToolContext["bridge"],
  { collections, libraries, used, within, format, maxChars, file }: TokensReadArgs,
): Promise<TokensRead> {
  const raw = await runOp(
    bridge,
    "variables",
    {
      libraries,
      used,
      ...(within === undefined ? {} : { within }),
    },
    file,
  );
  const model = tokenModel(raw, collections === undefined ? {} : { collections });
  const notes = [...model.notes];

  if (raw.libraryError !== undefined) {
    notes.push(raw.libraryError);
  }

  if (collections !== undefined) {
    const known = new Set(raw.collections.map((collection) => collection.name.toLowerCase()));
    const missing = collections.filter((name) => !known.has(name.toLowerCase()));

    if (missing.length > 0) {
      notes.push(
        `No collection is named ${missing.join(", ")}: the file has ${raw.collections.map((collection) => collection.name).join(", ") || "none"}.`,
      );
    }
  }

  if (raw.library !== undefined && raw.library.length === 0 && raw.libraryError === undefined) {
    notes.push("No library with variables is enabled in this file: libraries add nothing here.");
  }

  const library = raw.library === undefined ? undefined : listed(raw.library, notes);
  const summary = {
    collections: model.collections.map((collection) => ({
      name: collection.name,
      modes: collection.modes,
      variables: collection.variables.length,
    })),
    styles: {
      paint: model.styles.paint.length,
      text: model.styles.text.length,
      effect: model.styles.effect.length,
    },
  };
  const tokens = {
    collections: model.collections,
    styles: model.styles,
  };
  const css = format === "css" ? tokensCss(model) : null;
  const size = css?.length ?? JSON.stringify(tokens).length;

  if (size > maxChars) {
    // A design system can be thousands of variables: past maxChars the model gets the map and asks for parts.
    notes.push(
      `The tokens are ${size} characters, past maxChars (${maxChars}): read them a part at a time, e.g. ${model.collections
        .map((collection) => `collections: ${JSON.stringify([collection.name])}`)
        .slice(0, 5)
        .join(", ")}.`,
    );

    return {
      format,
      summary,
      ...(library === undefined ? {} : { library }),
      notes,
    };
  }

  return {
    format,
    ...(css === null
      ? { tokens }
      : {
          css,
          summary,
        }),
    ...(library === undefined ? {} : { library }),
    notes,
  };
}

/** The libraries' variables up to MAX_LIBRARY_VARIABLES names; the rest counted in a note. */
function listed(library: NonNullable<RawTokens["library"]>, notes: string[]): NonNullable<RawTokens["library"]> {
  let left = MAX_LIBRARY_VARIABLES;
  let hidden = 0;
  const kept = library.map((collection) => {
    const variables = collection.variables.slice(0, Math.max(0, left));

    hidden += collection.variables.length - variables.length;
    left -= variables.length;

    return {
      ...collection,
      variables,
    };
  });

  if (hidden > 0) {
    notes.push(
      `${hidden} more library variables are not listed: read a smaller set by naming collections in the library itself.`,
    );
  }

  return kept;
}
