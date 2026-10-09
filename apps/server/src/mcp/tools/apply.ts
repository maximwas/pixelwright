import type { McpServer } from "@modelcontextprotocol/server";
import {
  type ApplyChange,
  type ApplyError,
  changeOf,
  OPERATION_SCHEMAS,
  readApply,
  type SnapshotNode,
  unchangedAttributes,
} from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../../bridge/target.ts";
import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import { DesignApplyInputSchema, DesignApplyOutputSchema } from "../../schemas/tools.ts";
import type { ToolContext } from "../../types/mcp.ts";
import { registerTool } from "../register-tool.ts";

type DesignApplyArgs = z.output<typeof DesignApplyInputSchema>;
type DesignApplied = z.input<typeof DesignApplyOutputSchema>;

export function registerApplyTool(server: McpServer, { bridge }: ToolContext): void {
  registerTool(server, {
    name: "design_apply",
    title: "Write a design",
    description:
      'Writes Pixelwright XML, the format design_read returns, into Figma. An element with id changes that layer: only the attributes it gives, the rest stays as it is (write background="none", width="auto" to hug, display="block" to drop auto layout); an element without id creates a Frame, Section, Text, Rectangle, Ellipse or Line inside its parent element, in `parent`, or next to the layer before="id" / after="id" names. var(--Name) binds the style or variable of that name (as design_read and tokens_read write them); fonts are loaded for you. XML read with design_read and sent back unchanged changes nothing. Each element is written on its own: errors come back with their line and attribute while the rest goes in, and the whole call is one undo step in Figma. The plugin refuses writes while its Allow edits switch is off (dryRun checks without writing). Components, instances by name and images from files come in the next version: change existing ones by id. See guide write.',
    input: DesignApplyInputSchema,
    output: DesignApplyOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => applyDesign(bridge, args),
  });
}

/**
 * readApply, then the layers' entries from the plugin so what they already have is left out (unchangedAttributes),
 * then the changes in Figma's terms (changeOf) in one apply: all on the one file the call targets.
 */
export async function applyDesign(
  bridge: ToolContext["bridge"],
  { xml, parent, dryRun, file }: DesignApplyArgs,
): Promise<DesignApplied> {
  const read = readApply(xml);
  const errors: ApplyError[] = [...read.errors];
  const nothing = {
    created: [],
    changed: [],
    dryRun,
  };

  if (read.elements.length === 0) {
    return {
      ...nothing,
      errors,
    };
  }

  const target = resolveTarget(bridge.plugins(), file);
  const ids = [...new Set(read.elements.flatMap((element) => (element.id === null ? [] : [element.id])))];
  const layers = new Map<string, { node: SnapshotNode; parent: SnapshotNode | null }>();
  const tokens = {
    styles: {},
    variables: {},
  };

  if (ids.length > 0) {
    const entries = OPERATION_SCHEMAS.entries.output.parse(await bridge.request("entries", { ids }, target));

    tokens.styles = entries.styles;
    tokens.variables = entries.variables;

    for (const root of entries.roots) {
      index(root.node, root.parent, layers);
    }
  }

  const changes: ApplyChange[] = [];

  for (const element of read.elements) {
    const layer = element.id === null ? undefined : layers.get(element.id);
    const { change, errors: translated } = changeOf(
      element,
      layer === undefined ? undefined : unchangedAttributes(element, layer, tokens),
    );

    changes.push(change);
    errors.push(...translated);
  }

  const parents = new Set(
    changes.flatMap((change) => (change.kind === "create" && change.parent !== null ? [change.parent] : [])),
  );
  // What writes nothing stays here; an unchanged parent goes along so the layers made in it find it.
  const sent = changes.filter(
    (change) =>
      change.kind === "create" ||
      change.text !== undefined ||
      Object.keys(change.props).length > 0 ||
      parents.has(change.ref),
  );

  if (sent.length === 0) {
    return {
      ...nothing,
      errors: sorted(errors),
    };
  }

  const applied = OPERATION_SCHEMAS.apply.output.parse(
    await bridge.request(
      "apply",
      {
        changes: sent,
        ...(parent === undefined ? {} : { parent }),
        dryRun,
      },
      target,
    ),
  );

  return {
    created: applied.created,
    changed: applied.changed,
    errors: sorted([...errors, ...applied.errors]),
    dryRun,
  };
}

function index(
  node: SnapshotNode,
  parent: SnapshotNode | null,
  layers: Map<string, { node: SnapshotNode; parent: SnapshotNode | null }>,
): void {
  layers.set(node.id, {
    node,
    parent,
  });

  for (const child of node.children ?? []) {
    index(child, node, layers);
  }
}

function sorted(errors: readonly ApplyError[]): ApplyError[] {
  return errors.toSorted((a, b) => a.line - b.line || a.column - b.column);
}
