import type { McpServer } from "@modelcontextprotocol/server";
import {
  type ApplyChange,
  type ApplyElement,
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
/** A layer as the plugin read it, with its parent. */
type Layer = { node: SnapshotNode; parent: SnapshotNode | null };
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
  const layers = new Map<string, Layer>();
  const missing = new Set<string>();
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

    for (const id of entries.missing) {
      missing.add(id);
    }
  }

  const changes: ApplyChange[] = [];
  const refuse = (element: ApplyElement, message: string, hint: string) =>
    errors.push({
      line: element.line,
      column: element.column,
      ...(element.id === null ? {} : { id: element.id }),
      message,
      hint,
    });

  for (const element of read.elements) {
    const layer = element.id === null ? undefined : layers.get(element.id);

    if (element.id !== null && layer === undefined && !missing.has(element.id)) {
      // Past the read's size budget: unknown, so every attribute would be written again, rounded.
      refuse(
        element,
        `design_apply could not read ${element.id}'s current state: the call holds too many layers at once.`,
        "Send fewer layers in one call, or this one on its own.",
      );
      continue;
    }

    const { change, errors: translated } = changeOf(
      element,
      layer === undefined ? undefined : unchangedAttributes(element, layer, tokens),
    );

    changes.push(change);
    errors.push(...translated);
  }

  for (const [element, message] of moves(read.elements, layers)) {
    refuse(element, message, "Change it where it is; move it in Figma for now (moving comes in a later version).");
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

/**
 * Elements that would move their layer: into another parent element (a new one included), next to another layer, or
 * into another order among the layers listed with it. Writing moves comes later, and a silent no-op would mislead.
 */
function moves(elements: readonly ApplyElement[], layers: ReadonlyMap<string, Layer>): [ApplyElement, string][] {
  const byRef = new Map(elements.map((element) => [element.ref, element]));
  const found: [ApplyElement, string][] = [];
  const last = new Map<string, number>();

  for (const element of elements) {
    const layer = element.id === null ? undefined : layers.get(element.id);

    if (layer === undefined) {
      continue;
    }

    const inside = element.parent === null ? undefined : byRef.get(element.parent);
    const parent = layer.parent?.id ?? null;
    const where = parent === null ? "on its page" : `in ${parent}`;

    if (element.attributes.before !== undefined || element.attributes.after !== undefined) {
      found.push([
        element,
        `Moving a layer is not written yet: before and after place new layers, ${element.id} stays ${where}.`,
      ]);
    } else if (inside !== undefined && inside.id !== parent) {
      found.push([element, `Moving a layer is not written yet: ${element.id} stays ${where}.`]);
    } else if (inside !== undefined && parent !== null) {
      const at = (layers.get(parent)?.node.children ?? []).findIndex((child) => child.id === element.id);
      const before = last.get(parent) ?? -1;

      if (at !== -1 && at < before) {
        found.push([element, `Reordering layers is not written yet: ${element.id} keeps its place in the order.`]);
      }

      last.set(parent, Math.max(before, at));
    }
  }

  return found;
}

function index(node: SnapshotNode, parent: SnapshotNode | null, layers: Map<string, Layer>): void {
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
