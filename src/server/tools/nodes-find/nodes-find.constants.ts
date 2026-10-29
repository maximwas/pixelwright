/** nodes_find as clients list it (tools.json pins every word), 0.7.0's words. */
export const NODES_FIND_TOOL = {
  name: "nodes_find",
  title: "Find layers",
  description:
    'Finds layers on the current page, or inside `within` (a layer, a page, or "file" for every page), by name (substring), type (FRAME, TEXT, INSTANCE…), text content (substring), component (an instance\'s component or component set name) or variant (an instance\'s variant values, "State=Hover, Size=L"). Returns ids, names, types, boxes and the names of their ancestors, at most `limit` (more: true when there were more). Combine criteria to narrow down. counts: true also counts every instance found, past the limit, by component and variant: before deleting variants, which ones layers still use, without code.',
} as const;

export const NODES_FIND_FIELD = {
  variant:
    'Instances of one variant, e.g. "State=Hover, Size=L": every value given must be the main component\'s (in any order and case; the rest may be anything).',
  counts:
    "Also count every instance found, by component and variant, past the limit listed: before deleting a variant, how many layers use it.",
  within: 'Where to search: a layer or page id, or "file" for every page. Default: the current page.',
} as const;
