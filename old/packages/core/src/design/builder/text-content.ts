import { baseSegment, segmentCss } from "../../css-mapping/groups/text/run.ts";
import type { CssContext } from "../../types/css.ts";
import type { SnapshotNode, TextSegment } from "../../types/snapshot.ts";
import type { DesignAttribute, DesignContent } from "../tree.ts";
import { urlOf } from "./layer-attributes.ts";
import type { ReadCatalogue } from "./read-catalogue.ts";

/** What a span writes when the text it sits in has a property it lacks. */
const SPAN_RESETS: Readonly<Record<string, string>> = {
  "letter-spacing": "0",
  "text-transform": "none",
  "text-decoration": "none",
};

/**
 * A text's content: its characters, the runs that differ from its main one as spans with only what differs (and what
 * resets the main one's spacing, case or decoration). With `limit`, its first characters and an ellipsis, no spans.
 */
export function textContent(
  node: SnapshotNode,
  context: CssContext,
  catalogue: ReadCatalogue,
  limit: number | undefined,
): DesignContent[] {
  const characters = node.text?.characters ?? "";

  if (limit !== undefined) {
    return [
      ...pieces(characters.slice(0, limit)),
      {
        kind: "text",
        value: "…",
      },
    ];
  }

  const segments = node.text?.segments ?? [];
  const base = baseSegment(segments);

  for (const segment of segments) {
    catalogue.useFont(segment);
  }

  if (base === undefined || segments.length < 2) {
    return pieces(characters);
  }

  const baseCss = segmentCss(base, node, context, []);

  return segments.flatMap((segment) =>
    segment === base
      ? pieces(segment.characters)
      : runContent(segment, {
          node,
          context,
          catalogue,
          base,
          baseCss,
        }),
  );
}

/** What a run needs to be compared with the text's main one. */
interface RunScope {
  readonly node: SnapshotNode;
  readonly context: CssContext;
  readonly catalogue: ReadCatalogue;
  readonly base: TextSegment;
  readonly baseCss: ReturnType<typeof segmentCss>;
}

/** A run as a span with what it sets over the main run; plain characters when it sets nothing else. */
function runContent(segment: TextSegment, { node, context, catalogue, base, baseCss }: RunScope): DesignContent[] {
  const own = segmentCss(segment, node, context, []);
  const differs: DesignAttribute[] = [...own.css].filter(([property, value]) => baseCss.css.get(property) !== value);

  for (const property of baseCss.css.keys()) {
    const reset = SPAN_RESETS[property];

    if (!own.css.has(property) && reset !== undefined) {
      differs.push([property, reset]);
    }
  }

  const textStyle = own.textStyle === baseCss.textStyle ? undefined : catalogue.useTextStyle(own.textStyle);
  const href = urlOf([segment]);
  const linked = href === urlOf([base]) ? undefined : href;

  if (differs.length === 0 && textStyle === undefined && linked === undefined) {
    return pieces(segment.characters);
  }

  return [
    {
      kind: "span",
      attributes: [
        ...(textStyle === undefined ? [] : [["textStyle", textStyle] as const]),
        ...(linked === undefined ? [] : [["href", linked] as const]),
        ...differs,
      ],
      value: segment.characters,
    },
  ];
}

/** Characters as content: nothing for none, as XML reads an empty text back as nothing. */
function pieces(characters: string): DesignContent[] {
  return characters === ""
    ? []
    : [
        {
          kind: "text",
          value: characters,
        },
      ];
}
