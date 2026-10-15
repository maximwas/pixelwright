import { access } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Where a repository host's file link has the branch and path: what follows these segments of its path. */
const BLOB_MARKERS = [
  // github.com/<owner>/<repo>/blob/<branch>/<path>
  {
    host: /(^|\.)github\.com$/,
    after: ["blob"],
  },
  // gitlab.com/<group>/<repo>/-/blob/<branch>/<path>
  {
    host: /(^|\.)gitlab\.com$/,
    after: ["-", "blob"],
  },
  // bitbucket.org/<workspace>/<repo>/src/<branch>/<path>
  {
    host: /(^|\.)bitbucket\.org$/,
    after: ["src"],
  },
];

/**
 * The project file a Dev Mode link points at: a GitHub, GitLab or Bitbucket file link (a branch with slashes taking
 * the longest path that exists, line anchors dropped), or a vscode://file link inside the project. Undefined for
 * anything else, or a file that is not there.
 */
export async function linkPath(url: string, root: string): Promise<string | undefined> {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  if (parsed.protocol === "vscode:" && parsed.hostname === "file") {
    const path = decoded(parsed.pathname);

    return path === undefined ? undefined : editorPath(path, root);
  }

  const marker = BLOB_MARKERS.find(({ host }) => host.test(parsed.hostname));

  return marker === undefined ? undefined : repositoryPath(parsed.pathname, marker.after, root);
}

/** A file inside the project, from a vscode://file link's path (its :line:column dropped). */
async function editorPath(path: string, root: string): Promise<string | undefined> {
  const file = path.replace(/(:\d+){1,2}$/, "");

  return isAbsolute(file) ? projectFile(relative(root, file), root) : undefined;
}

/** The longest end of a file link's branch and path that is a file of the project. */
async function repositoryPath(pathname: string, after: readonly string[], root: string): Promise<string | undefined> {
  const segments = pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map(decoded);

  // A segment that does not decode, or decodes to a step up or a slash, names no file of the project.
  if (segments.some((segment) => segment === undefined || segment === ".." || segment.includes("/"))) {
    return undefined;
  }

  const at = segments.findIndex((_, index) => after.every((marker, offset) => segments[index + offset] === marker));

  if (at === -1) {
    return undefined;
  }

  // What follows is <branch>/<path>, the branch perhaps with slashes of its own: drop one segment at a time.
  const rest = segments.slice(at + after.length) as string[];

  for (let start = 1; start < rest.length; start += 1) {
    const found = await projectFile(rest.slice(start).join("/"), root);

    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

/** A path relative to the project as the project's file, when it stays inside and exists; with forward slashes. */
async function projectFile(path: string, root: string): Promise<string | undefined> {
  const inside = relative(root, resolve(root, path));

  if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
    return undefined;
  }

  return (await exists(join(root, inside))) ? inside.split(sep).join("/") : undefined;
}

/** A URL path decoded; undefined for one that does not decode (a lone %). */
function decoded(path: string): string | undefined {
  try {
    return decodeURIComponent(path);
  } catch {
    return undefined;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}
