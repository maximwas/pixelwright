/** components_read as clients list it (tools.json pins every word): 0.7.0's words, Code Connect gone. */
export const COMPONENTS_READ_TOOL = {
  name: "components_read",
  title: "Read the components",
  description:
    'Lists components: scope used (default) gives the ones the instances on the current page, or inside `within`, come from (a library\'s among them, with how many instances use each); scope local gives every component defined in the file. Each comes with its key, variants, properties (type, default, and for a VARIANT property its options: the values it can take), description and `exposed` (the nested instances whose properties its instances show: in code they are its props too). `instances: true` lists its instances in `instanceNodes` {id, name, page} (100 at most, instanceNodesMore past them); `references: true` lists per property the layers bound to it {id, name, field}. `links: true` also reads the links people attached to it in Dev Mode (code, stories, docs), on Figma plans that keep them; a link to a GitHub, GitLab or Bitbucket file, or a vscode://file link, names the project file it points at in `path`. A big section lists long: `fields` keeps only the ones named, so scope local with query "icon/" and fields ["name"] lists the icon sets by name.',
} as const;

export const COMPONENTS_READ_FIELD = {
  scope: "used: what the page (or within) uses; local: what the file defines.",
  within: "A layer or page id to look in. Default: the current page (used) or every page (local).",
  query: 'Only components whose name contains this, e.g. "icon/" for the icon sets.',
  fields: 'Only these fields of each component, e.g. ["name", "id", "description"]. Default: all.',
  instances: "Also list each component's instances (a set's, of every variant) with their pages, 100 at most.",
  references:
    "Also list, per property, the layers inside the component bound to it and the field each binds (visible, characters, mainComponent).",
  links: "Also read the links people attached in Dev Mode (Figma's servers, paid plans only).",
  path: "The project file a code link points at.",
  components: "Each component, with only the fields asked for when fields is given.",
} as const;

export const COMPONENTS_READ_TEXT = {
  pageNotRead: (name: string, error: string) =>
    `The page ${name} could not be read (${error}): its components are not listed.`,
} as const;

/** Where a repository host's file link has the branch and path: what follows these segments of its path (T-192). */
export const LINK_HOSTS = [
  // github.com/<owner>/<repo>/blob/<branch>/<path>
  { host: /(^|\.)github\.com$/, after: ["blob"] },
  // gitlab.com/<group>/<repo>/-/blob/<branch>/<path>
  { host: /(^|\.)gitlab\.com$/, after: ["-", "blob"] },
  // bitbucket.org/<workspace>/<repo>/src/<branch>/<path>
  { host: /(^|\.)bitbucket\.org$/, after: ["src"] },
] as const;

/** A vscode://file link, a link path's separator, a step up, and an editor link's :line:column. */
export const LINK_PATH = {
  editorProtocol: "vscode:",
  editorHost: "file",
  separator: "/",
  up: "..",
  lineColumn: /(:\d+){1,2}$/,
} as const;
