import { DESIGN_APPLY_TOOL } from "@/server/tools/design-apply/design-apply.constants.ts";
import { DESIGN_READ_TOOL } from "@/server/tools/design-read/design-read.constants.ts";
import { EXECUTE_TOOL } from "@/server/tools/execute/execute.constants.ts";
import { GUIDE_TOOL } from "@/server/tools/guide/guide.constants.ts";
import { INSPECT_MANIFEST } from "@/server/tools/inspect/inspect.manifest.ts";
import { NODES_DELETE_TOOL } from "@/server/tools/nodes-delete/nodes-delete.constants.ts";
import { NODES_FIND_MANIFEST } from "@/server/tools/nodes-find/nodes-find.manifest.ts";
import { STATUS_MANIFEST } from "@/server/tools/status/status.manifest.ts";
import { TOKENS_READ_MANIFEST } from "@/server/tools/tokens-read/tokens-read.manifest.ts";
import { TOKENS_USAGE_MANIFEST } from "@/server/tools/tokens-usage/tokens-usage.manifest.ts";
import { TYPES_READ_TOOL } from "@/server/tools/types-read/types-read.constants.ts";
import { VERSION_SAVE_TOOL } from "@/server/tools/version-save/version-save.constants.ts";

/** The JSON Schema the SDK asks for: draft 2020-12 only (its own fallback's target), of a schema's input or output. */
export const TOOL_JSON_SCHEMA = { target: "draft-2020-12", input: "input", output: "output" } as const;

/**
 * The server instructions a client gets at connect (T-007): what Pixelwright does, design_read's answer as the whole build,
 * design_apply as the write path behind Allow edits (m:0141f392), execute as the exception (O-041), start with status,
 * the support rule.
 * The tool's name comes from its manifest, so a renamed tool cannot leave a stale sentence (D-31).
 */
export const SERVER_INSTRUCTIONS = `Pixelwright reads and writes the Figma files open in Figma Desktop, through the Pixelwright plugin running in each file; nothing goes to Figma's REST API. Read with the read tools (${GUIDE_TOOL.name} workflow says which one when): ${DESIGN_READ_TOOL.name}'s answer is complete for building a layer in code. Write with ${DESIGN_APPLY_TOOL.name}, which takes ${DESIGN_READ_TOOL.name}'s XML back (${GUIDE_TOOL.name} write and layout); ${NODES_DELETE_TOOL.name} deletes layers, and ${VERSION_SAVE_TOOL.name} saves a named version when the user asks. Every write needs the plugin's Allow edits switch on; ${DESIGN_APPLY_TOOL.name}'s dryRun checks a change without it. ${EXECUTE_TOOL.name} runs plugin code and is the exception: for what no tool reads, and for a change ${DESIGN_APPLY_TOOL.name} cannot say. Before code, the reads answer: layers by text (a list or textRegex), size, visibility, component and the properties instances change, with ancestors and page (${NODES_FIND_MANIFEST.name}); a whole subtree with its auto layout gaps and paddings, parent layout, text runs and component properties (${INSPECT_MANIFEST.name} within and fields); a token by name with its id and alias chain (${TOKENS_READ_MANIFEST.name} query); colours bound to no token (${TOKENS_USAGE_MANIFEST.name} raw: true). When one answer needs several reads filtered or joined, ${EXECUTE_TOOL.name} script runs them in one call on the server (${TYPES_READ_TOOL.name} gives their answer types first). Start with ${STATUS_MANIFEST.name}: it lists the connected files, which one tools use by default, and what to do when none is connected. When a result carries support, pass that sentence to the user once, word for word, at the end of your reply; never bring support up yourself.`;

/** A second connect is a bug in the composition root. */
export const MCP_ENDPOINT_ERROR = { connected: "The MCP endpoint is connected already." } as const;
