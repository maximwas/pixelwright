import { classify, visibleChildren } from "../../design/assets/classify.ts";
import { DEFAULT_NAME } from "../../design/hints/layer-hints.ts";
import type { Snapshot, SnapshotNode } from "../../types/snapshot.ts";
import { controlOf } from "./controls.ts";
import { headingNotes, headingsOf, screenTexts } from "./headings.ts";
import type { A11yControl, A11yRead } from "./schemas.ts";

/** The most entries a list keeps. */
const MAX_LISTED = 100;

/** What a walk of the screen gathers: its texts, controls and pictures, and where order or nesting goes wrong. */
interface Gathered {
  readonly texts: SnapshotNode[];
  readonly controls: A11yControl[];
  readonly images: A11yRead["images"];
  readonly order: string[];
  readonly nested: string[];
}

/**
 * A screen's accessibility as its markup needs it: the headings and their levels, the controls with their roles and
 * labels, the pictures that need an alt, where layers read in another order than they show, and what to fix.
 */
export function a11yRead(snapshot: Snapshot): A11yRead {
  const gathered: Gathered = {
    texts: [],
    controls: [],
    images: [],
    order: [],
    nested: [],
  };

  walk(
    snapshot.root,
    {
      parent: null,
      root: snapshot.root,
      control: null,
    },
    gathered,
  );

  const headings = headingsOf(screenTexts(gathered.texts, snapshot));
  const notes = [...headingNotes(headings), ...gathered.nested, ...labelNotes(gathered)];

  return {
    summary: `${headings.length} headings, ${gathered.controls.length} controls, ${gathered.images.length} pictures; ${notes.length} ${notes.length === 1 ? "thing" : "things"} to fix.`,
    headings: headings.slice(0, MAX_LISTED),
    controls: gathered.controls.slice(0, MAX_LISTED),
    images: gathered.images.slice(0, MAX_LISTED),
    order: gathered.order,
    notes,
  };
}

/** Where the walk is: the layer's parent, the screen, and the control it is inside. */
interface Place {
  readonly parent: SnapshotNode | null;
  readonly root: SnapshotNode;
  readonly control: A11yControl | null;
}

function walk(node: SnapshotNode, place: Place, gathered: Gathered): void {
  if (!node.visible) {
    return;
  }

  const control = node === place.root ? null : controlOf(node, place.parent);

  if (control !== null) {
    gathered.controls.push(control);

    if (place.control !== null) {
      gathered.nested.push(
        `${control.id} "${control.name}" is a ${control.role} inside the ${place.control.role} ${place.control.id} "${place.control.name}": a screen reader cannot reach one inside the other; make them siblings.`,
      );
    }
  }

  const inside = control ?? place.control;

  if (inside === null && node.type === "TEXT") {
    gathered.texts.push(node);
  }

  if (inside === null && node !== place.root && picture(node, place.root, gathered)) {
    return;
  }

  orderNote(node, gathered);

  for (const child of node.children ?? []) {
    walk(
      child,
      {
        parent: node,
        root: place.root,
        control: inside,
      },
      gathered,
    );
  }
}

/** A picture outside controls, with an alt from its name; true when the layer is one (its layers are its picture). */
function picture(node: SnapshotNode, root: SnapshotNode, gathered: Gathered): boolean {
  const asset = classify(node, root);

  if (asset === null) {
    return false;
  }

  gathered.images.push({
    id: node.id,
    name: node.name,
    alt: asset.kind === "icon" || DEFAULT_NAME.test(node.name) ? null : node.name,
    decorative: asset.kind === "icon",
  });

  return true;
}

/** A frame placing its children by hand whose layers do not list them in the order they show (rows, then columns). */
function orderNote(node: SnapshotNode, gathered: Gathered): void {
  const children = visibleChildren(node);

  if (node.layoutMode !== undefined || node.type === "INSTANCE" || node.type === "TEXT" || children.length < 2) {
    return;
  }

  const shown = [...children].sort((a, b) =>
    Math.abs(a.y - b.y) < Math.min(a.height, b.height) / 2 ? a.x - b.x : a.y - b.y,
  );
  const at = shown.findIndex((child, index) => child !== children[index]);
  const first = shown[at];
  const listed = children[at];

  if (at !== -1 && first !== undefined && listed !== undefined) {
    gathered.order.push(
      `${node.id} "${node.name}" shows ${first.id} "${first.name}" before ${listed.id} "${listed.name}", but its layers list them the other way: order them as they read.`,
    );
  }
}

/** A note about how many of something need fixing, worded for one or for several; none when nothing does. */
function countNote(count: number, one: string, several: (count: number) => string): string[] {
  return count === 0 ? [] : [count === 1 ? one : several(count)];
}

/** Controls, fields and pictures that need a label or an alt. */
function labelNotes({ controls, images }: Gathered): string[] {
  const field = (control: A11yControl) => control.role === "textbox" || control.role === "combobox";
  const unlabelled = controls.filter((control) => control.label === null && !field(control)).length;
  const fields = controls.filter((control) => control.label === null && field(control)).length;
  const unnamed = images.filter(({ alt, decorative }) => alt === null && !decorative).length;

  return [
    ...countNote(
      unlabelled,
      "1 control has no label: give it an aria-label (suggested).",
      (count) => `${count} controls have no label: give each an aria-label (suggested).`,
    ),
    ...countNote(
      fields,
      "1 field has no label next to it: give it a visible label or an aria-label.",
      (count) => `${count} fields have no label next to them: give each a visible label or an aria-label.`,
    ),
    ...countNote(
      unnamed,
      "1 picture has no name to make an alt from: describe what it shows, or mark it decorative.",
      (count) =>
        `${count} pictures have no name to make an alt from: describe what each shows, or mark them decorative.`,
    ),
  ];
}
