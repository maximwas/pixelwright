import { withoutUrls } from "../../css-mapping/values/css-values.ts";
import { contentXmlOf } from "../../design/serializer.ts";
import type { DesignElement } from "../../design/tree.ts";
import type { SnapshotNode } from "../../types/snapshot.ts";
import { fingerprint } from "../compare/fingerprint.ts";
import type { Pair } from "./types.ts";

/** Attributes a baseline's diff never compares: the id, a planned file's path, the marks of a cut. */
const LEFT_OUT: ReadonlySet<string> = new Set(["id", "src", "$children", "$truncated"]);
/** Where the root sits in its parent: the design around it, not the design itself. */
const ROOT_PLACEMENT: ReadonlySet<string> = new Set(["position", "left", "top", "right", "bottom", "transform"]);
/** Attributes listing name=value pairs: only the pairs that differ are kept. */
const LISTS: ReadonlySet<string> = new Set(["props", "variant"]);
/** Tags whose look is a file of its own: compared by what draws them too. */
const DRAWN: ReadonlySet<string> = new Set(["Icon", "Image"]);

/** The snapshots' layers by id, and whether one plugin version read both. */
export interface DrawingSources {
  readonly before: ReadonlyMap<string, SnapshotNode>;
  readonly after: ReadonlyMap<string, SnapshotNode>;
  readonly sameReader: boolean;
}

/**
 * How a pair of layers differs as design_read writes them: the attributes as [before, now] (ids, planned file paths and
 * a cut's marks aside; url() paths emptied; the root's placement aside; props and variant reduced to the pairs that
 * differ), the tag as $tag, a text's inner XML as $text.
 */
export function changedAttributes(before: DesignElement, after: DesignElement, root: boolean): Record<string, Pair> {
  const left = Object.fromEntries(before.attributes);
  const right = Object.fromEntries(after.attributes);
  const changed: Record<string, Pair> = {};

  if (before.tag !== after.tag) {
    changed.$tag = [before.tag, after.tag];
  }

  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const pair = LEFT_OUT.has(key) || (root && ROOT_PLACEMENT.has(key)) ? null : compared(key, left[key], right[key]);

    if (pair !== null) {
      changed[key] = pair;
    }
  }

  const text: Pair = [textOf(before), textOf(after)];

  if (text[0] !== text[1]) {
    changed.$text = text;
  }

  return changed;
}

/**
 * Whether a pair is drawn anew: an icon's or image's drawing (as its snapshot knows it, over the fields both reads hold
 * when two plugin versions read them), or another image in the layer's own fills.
 */
export function drawnAnew(beforeId: string, afterId: string, tag: string, sources: DrawingSources): boolean {
  const before = sources.before.get(beforeId);
  const after = sources.after.get(afterId);

  if (DRAWN.has(tag)) {
    const keeps = sources.sameReader ? undefined : sharedKeys(before, after);

    if (fingerprint(before, keeps) !== fingerprint(after, keeps)) {
      return true;
    }
  }

  return imageHashes(before) !== imageHashes(after);
}

/** A text's content as its XML holds it, spans included; null for any other element. */
export function textOf(element: DesignElement): string | null {
  return element.content === null ? null : contentXmlOf(element.content);
}

function compared(key: string, before: string | undefined, after: string | undefined): Pair | null {
  const pair: Pair = [before ?? null, after ?? null];

  if (pair[0] === pair[1]) {
    return null;
  }

  if (LISTS.has(key)) {
    return differingItems(pair);
  }

  return pair[0] !== null && pair[1] !== null && withoutUrls(pair[0]) === withoutUrls(pair[1]) ? null : pair;
}

/** The name=value items each side holds and the other does not; null when both hold the same ones. */
function differingItems([before, after]: Pair): Pair | null {
  const left = itemsOf(before);
  const right = itemsOf(after);
  const onlyLeft = left.filter((item) => !right.includes(item));
  const onlyRight = right.filter((item) => !left.includes(item));

  if (onlyLeft.length === 0 && onlyRight.length === 0) {
    return null;
  }

  return [onlyLeft.length === 0 ? null : onlyLeft.join(", "), onlyRight.length === 0 ? null : onlyRight.join(", ")];
}

/** A list's items as design_read writes them: separated by ", ", a backslash escaping the next character. */
function itemsOf(list: string | null): string[] {
  if (list === null) {
    return [];
  }

  const items: string[] = [];
  let item = "";

  for (let index = 0; index < list.length; index++) {
    const char = list[index] ?? "";

    if (char === "\\") {
      item += char + (list[index + 1] ?? "");
      index++;
    } else if (char === "," && list[index + 1] === " ") {
      items.push(item);
      item = "";
      index++;
    } else {
      item += char;
    }
  }

  return [...items, item];
}

/** The fields a layer's two reads both hold, at any depth. */
function sharedKeys(before: SnapshotNode | undefined, after: SnapshotNode | undefined): (key: string) => boolean {
  const left = keysOf(before);
  const right = keysOf(after);

  return (key) => left.has(key) && right.has(key);
}

function keysOf(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      keysOf(item, keys);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      keysOf(item, keys);
    }
  }

  return keys;
}

/** The images a layer's own fills hold, in order. */
function imageHashes(node: SnapshotNode | undefined): string {
  const fills = Array.isArray(node?.fills) ? node.fills : [];

  return fills.flatMap((paint) => (typeof paint.imageHash === "string" ? [paint.imageHash] : [])).join(" ");
}
