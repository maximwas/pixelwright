/** The node types a find tells apart (T-040). */
export const FIND_NODE_TYPE = {
  text: "TEXT",
  instance: "INSTANCE",
  componentSet: "COMPONENT_SET",
  page: "PAGE",
  document: "DOCUMENT",
} as const;

export const FIND_TEXT = {
  variant: 'variant is a list of Name=Value, separated by commas: "State=Hover, Size=L".',
} as const;
