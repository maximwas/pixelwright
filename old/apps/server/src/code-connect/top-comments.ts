/** The `// key=value` comments before a file's first code, by key in lower case. */
export function topComments(source: string): Map<string, string> {
  const comments = new Map<string, string>();

  for (const line of source.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (!trimmed.startsWith("//")) {
      break;
    }

    const comment = /^\/\/\s*([a-zA-Z]+)\s*=\s*(.*)$/.exec(trimmed);

    if (comment !== null) {
      comments.set((comment[1] ?? "").toLowerCase(), (comment[2] ?? "").trim());
    }
  }

  return comments;
}

/** What a file without a url= or key= comment says of itself: an old figma.connect file, or a template missing its link. */
export function unlinked(path: string, source: string): string[] {
  if (/\bfigma\.connect\s*\(/.test(source)) {
    return [
      `${path}: a figma.connect file, which Pixelwright does not run: npx figma connect migrate turns it into a template.`,
    ];
  }

  return /from\s+["']figma["']|require\(\s*["']figma["']\s*\)/.test(source)
    ? [`${path}: no // url= comment at the top: Figma needs the component's link there.`]
    : [];
}

/** A Figma link's file key and node id: /design/<key>/ or /file/<key>/, node-id 1-2 or 1:2 → 1:2. */
export function figmaLink(url: string): { nodeId: string; fileKey: string } | null {
  try {
    const parsed = new URL(url);
    const fileKey = /^\/(?:design|file|proto)\/([^/]+)/.exec(parsed.pathname)?.[1];
    const node = parsed.searchParams.get("node-id");

    if (fileKey === undefined || node === null || !/^\d+[-:]\d+$/.test(node)) {
      return null;
    }

    return {
      nodeId: node.replace("-", ":"),
      fileKey,
    };
  } catch {
    return null;
  }
}

/** A comment's value, or nothing when it is missing or blank. */
export function given(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
