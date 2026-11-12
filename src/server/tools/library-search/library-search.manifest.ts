import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { LIBRARY_SEARCH_TOOL } from "@/server/tools/library-search/library-search.constants.ts";
import {
  LibrarySearchInputSchema,
  LibrarySearchOutputSchema,
} from "@/server/tools/library-search/library-search.schema.ts";

export const LIBRARY_SEARCH_MANIFEST: ToolManifest = {
  name: LIBRARY_SEARCH_TOOL.name,
  title: LIBRARY_SEARCH_TOOL.title,
  description: LIBRARY_SEARCH_TOOL.description,
  input: LibrarySearchInputSchema,
  output: LibrarySearchOutputSchema,
  annotations: TOOL_ANNOTATIONS.read,
  load: async () => (await import("@/server/tools/library-search/library-search.tool.ts")).LibrarySearchTool,
};
