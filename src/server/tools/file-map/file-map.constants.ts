/** file_map as clients list it (tools.json pins every word), 0.7.0's words. */
export const FILE_MAP_TOOL = {
  name: "file_map",
  title: "Map the file",
  description:
    "Every page of the file by id and name, with its top layers (frames, sections, components) and, inside each section, its own, with their types and sizes, in one call: where to start in a big file. Pages load one at a time; past the time a call has, more: true and the pages left have no nodes (outline them one by one). A page Figma cannot load (its connection is down, say) has no nodes either and is in pagesNotRead with Figma's words; the other pages are still mapped.",
} as const;
