/** nodes_find as clients list it (tools.json pins every word), 0.7.0's words. */
export const NODES_FIND_TOOL = {
  name: "nodes_find",
  title: "Find layers",
  description:
    'Recipe: texts holding words anywhere in the file: within "file" + text ["word", ...] + fields ["path","page","hidden"]; path[0] is the top-level layer a text sits in (an empty path: the text is top-level). Finds layers on the current page, or inside `within` (a layer or page id, a list of them for several roots in one call, or "file" for every page), by name (substring), type (FRAME, TEXT, INSTANCE…), text content (a substring, or a list of them: any matches; textRegex: a JavaScript regular expression, any case), component (an instance\'s component or component set name), componentId (an instance\'s component, or any variant of a component set, by id) or variant (an instance\'s variant values, "State=Hover, Size=L") or fill (a visible fill of a Figma paint type: IMAGE gives the image layers). Returns ids, names, types, boxes, a text\'s characters (its first 200, cut: true past them), and its ancestors\' ids, names and types in `path` (within "file" also its `page`), with hidden: true on a layer a viewer does not see (visible: true or false keeps only shown or hidden ones), a text\'s fontSize (its distinct sizes when mixed) and an instance\'s component (its main component\'s name, and set for a variant) and changed properties (those differing from its component\'s defaults; properties: true gives every property\'s value, variant values included), fontSize (lt, lte, gt and gte keep texts with a size under, up to, over or from that many px: {"gte": 12, "lt": 16} keeps 12 up to under 16), and `fields` keeps only the named fields of each layer (id, name and type stay: fields ["fontSize"] drops box and path), at most `limit` (more: true when there were more). Combine criteria to narrow down. counts: true also counts every instance found, past the limit, by component and variant: before deleting variants, which ones layers still use, without code. An absent field is at its default (no hidden is visible; no changed means no changed properties, or the component\'s defaults could not be read) and the answer is complete unless `more` is true or a note says the scan stopped.',
} as const;

export const NODES_FIND_FIELD = {
  variant:
    'Instances of one variant, e.g. "State=Hover, Size=L": every value given must be the main component\'s (in any order and case; the rest may be anything).',
  text: "Texts whose characters contain this, or any of these phrases, in any case.",
  textRegex: 'Texts whose characters match this JavaScript regular expression, in any case, e.g. "^\\$\\d+".',
  fontSize:
    'Texts by font size in px: lt (under), lte (up to), gt (over) and gte (from), e.g. {"gte": 12, "lt": 16} for 12 up to under 16; a text with mixed sizes matches when any size does.',
  fields:
    'Only these fields of each layer found, besides id, name and type, e.g. ["fontSize"] drops box and path. Default: all.',
  componentId: "Instances of this component, or of any variant of this component set, by id.",
  properties:
    "Also give every component property's value on each instance found, by name; a variant property's value is among them (State: \"Hover\"), so the variant of each instance needs no other call.",
  foundPage: 'Within "file": the page the layer is on.',
  counts:
    "Also count every instance found, by component and variant, past the limit listed: before deleting a variant, how many layers use it.",
  visible:
    "true: only layers a viewer sees (the layer and every ancestor visible); false: only hidden ones: within a component's id, its hidden layers and those under a hidden one. Default: both.",
  name: "Layers whose name contains this, in any case.",
  type: "Layers of this Figma type, e.g. FRAME, TEXT, INSTANCE, COMPONENT, RECTANGLE.",
  component:
    'Instances whose component or set name contains this, in any case ("Button" also matches "Icon Button"), at any depth, inside other instances too; each comes with `component`, the component and set it is of, and `changed`, the properties it sets away from the component\'s defaults.',
  limit: "At most this many layers listed; more: true when there were more. counts still counts them all.",
  within:
    'Where to search: a layer or page id, a list of up to 50 (each searched in turn, one answer; a layer under two roots is listed once), or "file" alone for every page. Default: the current page.',
  fill: "Layers with a visible fill of this Figma paint type: IMAGE, SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND, VIDEO or PATTERN; IMAGE gives every image layer.",
  page: "Without within: the name of the current page, the one searched.",
  hint: "When nothing was found on the current page: how to search elsewhere.",
} as const;

/** What every layer nodes_find answers keeps, whatever `fields` names. */
export const NODES_FIND_KEPT = ["id", "name", "type"] as const;

/** What nodes_find says of the current page it searched without within (T-040). */
export const NODES_FIND_TEXT = {
  unsafeRegex:
    "textRegex may backtrack for so long that it freezes Figma. Use text phrases, or a pattern without a repeated group such as (a+)+ or (\\w+\\s?)*.",
  nothing: (page: string) =>
    `Nothing found on the current page, "${page}": pass within (a page id, or "file" for every page) to search elsewhere.`,
} as const;
