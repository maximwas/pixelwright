import { designXml } from "../design/design-xml.ts";
import type { DesignDiff, DiffChange } from "../types/diff.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import type { XmlElementNode } from "../types/xml.ts";
import { parseXml } from "../xml/parse/parse-xml.ts";

/** What names a root or says where it is: two variants side by side differ there by nature (src follows the name). */
const ROOT_PLACEMENT = new Set(["name", "src", "position", "left", "top", "right", "bottom", "transform"]);
/** Tags whose look is a file of its own: compared by what draws them too. */
const DRAWN = new Set(["Icon", "Image"]);
/** Snapshot fields that name or place a layer rather than draw it. */
const NOT_DRAWING = new Set(["id", "name", "x", "y", "bounds", "renderBounds", "css"]);

/**
 * How layer B differs from layer A as design_read reads them: layers matched by their path of names below the roots
 * (same-named siblings in order), attributes and text compared, ids and the roots' own name and place left out; an
 * icon's or image's drawing is compared through what the snapshot knows of it (paths hashed, paints, inner layers).
 */
export function designDiff(a: Snapshot, b: Snapshot): DesignDiff {
  const diff: Omit<DesignDiff, "same"> = {
    onlyInA: [],
    onlyInB: [],
    changed: [],
  };

  compare(rootOf(a), rootOf(b), "", true, {
    a: nodesOf(a.root),
    b: nodesOf(b.root),
    diff,
  });

  return {
    same: diff.onlyInA.length === 0 && diff.onlyInB.length === 0 && diff.changed.length === 0,
    ...diff,
  };
}

interface Walk {
  readonly a: ReadonlyMap<string, SnapshotNode>;
  readonly b: ReadonlyMap<string, SnapshotNode>;
  readonly diff: Omit<DesignDiff, "same">;
}

function compare(x: XmlElementNode, y: XmlElementNode, path: string, root: boolean, walk: Walk): void {
  const attributes: DiffChange["attributes"] = {};

  for (const key of new Set([...Object.keys(x.props), ...Object.keys(y.props)])) {
    if (key === "id" || (root && ROOT_PLACEMENT.has(key))) {
      continue;
    }

    const left = x.props[key] ?? null;
    const right = y.props[key] ?? null;

    if (left !== right) {
      attributes[key] = [left, right];
    }
  }

  const [textA, textB] = [textOf(x), textOf(y)];

  if (textA !== textB) {
    attributes.$text = [textA, textB];
  }

  const drawing =
    DRAWN.has(x.type) && fingerprint(walk.a.get(x.props.id ?? "")) !== fingerprint(walk.b.get(y.props.id ?? ""));

  if (Object.keys(attributes).length > 0 || drawing) {
    walk.diff.changed.push({
      path: path === "" ? "(root)" : path,
      a: x.props.id ?? "",
      b: y.props.id ?? "",
      attributes,
      ...(drawing ? { drawing: true as const } : {}),
    });
  }

  const left = keyed(x);
  const right = keyed(y);

  for (const [key, elements] of left) {
    const others = right.get(key) ?? [];

    elements.forEach((element, index) => {
      const label = labelOf(element, index);
      const childPath = path === "" ? label : `${path} / ${label}`;
      const other = others[index];

      if (other === undefined) {
        walk.diff.onlyInA.push({
          path: childPath,
          id: element.props.id ?? "",
        });
      } else {
        compare(element, other, childPath, false, walk);
      }
    });
  }

  for (const [key, elements] of right) {
    const count = left.get(key)?.length ?? 0;

    elements.slice(count).forEach((element, index) => {
      const label = labelOf(element, count + index);

      walk.diff.onlyInB.push({
        path: path === "" ? label : `${path} / ${label}`,
        id: element.props.id ?? "",
      });
    });
  }
}

function rootOf(snapshot: Snapshot): XmlElementNode {
  const [root] = parseXml(designXml(snapshot).xml).filter((child) => child.kind === "element");

  if (root === undefined || root.kind !== "element") {
    throw new Error("design_read wrote no element for the layer");
  }

  return root;
}

/** Element children by tag and name, each list in document order. */
function keyed(element: XmlElementNode): Map<string, XmlElementNode[]> {
  const groups = new Map<string, XmlElementNode[]>();

  for (const child of element.children) {
    if (child.kind === "element") {
      const key = `${child.type} ${child.props.name ?? ""}`;

      groups.set(key, [...(groups.get(key) ?? []), child]);
    }
  }

  return groups;
}

function labelOf(element: XmlElementNode, index: number): string {
  return `${element.type} "${element.props.name ?? ""}"${index > 0 ? `[${index + 1}]` : ""}`;
}

function textOf(element: XmlElementNode): string | null {
  const texts = element.children.filter((child) => child.kind === "text").map((child) => child.value);

  return texts.length === 0 ? null : texts.join("");
}

function nodesOf(root: SnapshotNode): Map<string, SnapshotNode> {
  const nodes = new Map<string, SnapshotNode>();
  const walk = (node: SnapshotNode) => {
    nodes.set(node.id, node);
    node.children?.forEach(walk);
  };

  walk(root);

  return nodes;
}

/** What draws a layer, without what names or places it: equal for two copies of one icon. */
function fingerprint(node: SnapshotNode | undefined): string {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(strip);
    }

    if (typeof value !== "object" || value === null) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !NOT_DRAWING.has(key))
        .toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, strip(item)]),
    );
  };

  return JSON.stringify(strip(node ?? null));
}
