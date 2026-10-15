import type { DesignDiff, DiffChange } from "../types/diff.ts";
import type { Snapshot, SnapshotNode } from "../types/snapshot.ts";
import { type Compared, comparedRoot, labelOf } from "./compare/compared.ts";
import { fingerprint, nodesOf } from "./compare/fingerprint.ts";

/** What names a root or says where it is: two variants side by side differ there by nature (src follows the name). */
const ROOT_PLACEMENT = new Set(["name", "src", "position", "left", "top", "right", "bottom", "transform"]);
/** Tags whose look is a file of its own: compared by what draws them too. */
const DRAWN = new Set(["Icon", "Image"]);

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

  compare(comparedRoot(a), comparedRoot(b), "", {
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

/** Two matched elements and, below them, their children; the path is empty at the roots. */
function compare(x: Compared, y: Compared, path: string, walk: Walk): void {
  const attributes = changedAttributes(x, y, path === "");
  const drawing = DRAWN.has(x.tag) && fingerprint(walk.a.get(x.id)) !== fingerprint(walk.b.get(y.id));

  if (Object.keys(attributes).length > 0 || drawing) {
    walk.diff.changed.push({
      path: path === "" ? "(root)" : path,
      a: x.id,
      b: y.id,
      attributes,
      ...(drawing ? { drawing: true as const } : {}),
    });
  }

  compareChildren(x, y, path, walk);
}

/** The attributes and the text that differ, as [A, B]; ids, and a root's own name and place, aside. */
function changedAttributes(x: Compared, y: Compared, root: boolean): DiffChange["attributes"] {
  const attributes: DiffChange["attributes"] = {};

  for (const key of new Set([...Object.keys(x.attributes), ...Object.keys(y.attributes)])) {
    if (key === "id" || (root && ROOT_PLACEMENT.has(key))) {
      continue;
    }

    const left = x.attributes[key] ?? null;
    const right = y.attributes[key] ?? null;

    if (left !== right) {
      attributes[key] = [left, right];
    }
  }

  if (x.text !== y.text) {
    attributes.$text = [x.text, y.text];
  }

  return attributes;
}

/** Children matched by tag and name, in order; the ones past the other side's count are only on one side. */
function compareChildren(x: Compared, y: Compared, path: string, walk: Walk): void {
  const left = keyed(x);
  const right = keyed(y);
  const pathOf = (element: Compared, index: number) =>
    path === "" ? labelOf(element, index) : `${path} / ${labelOf(element, index)}`;

  for (const [key, elements] of left) {
    const others = right.get(key) ?? [];

    elements.forEach((element, index) => {
      const other = others[index];

      if (other === undefined) {
        walk.diff.onlyInA.push({
          path: pathOf(element, index),
          id: element.id,
        });
      } else {
        compare(element, other, pathOf(element, index), walk);
      }
    });
  }

  for (const [key, elements] of right) {
    const count = left.get(key)?.length ?? 0;

    elements.slice(count).forEach((element, index) => {
      walk.diff.onlyInB.push({
        path: pathOf(element, count + index),
        id: element.id,
      });
    });
  }
}

/** Children by tag and name, each list in document order. */
function keyed(element: Compared): Map<string, Compared[]> {
  const groups = new Map<string, Compared[]>();

  for (const child of element.children) {
    const key = `${child.tag} ${child.attributes.name ?? ""}`;

    groups.set(key, [...(groups.get(key) ?? []), child]);
  }

  return groups;
}
