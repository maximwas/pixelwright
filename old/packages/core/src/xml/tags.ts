/** The XML tag for a Figma node type: the type in PascalCase (FRAME → Frame, BOOLEAN_OPERATION → BooleanOperation). */
export function tagFor(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}
