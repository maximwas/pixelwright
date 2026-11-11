/** nodes_delete as clients list it (T-045). */
export const NODES_DELETE_TOOL = {
  name: "nodes_delete",
  title: "Delete layers",
  description:
    "Deletes up to 500 layers by id, each on its own: one Figma will not delete (a layer inside an instance, which comes from its component) stays, with why. What an instance's slot holds is the instance's own and is deleted. One call is one undo step in Figma. dryRun lists what would be deleted and works with Allow edits off; version saves a named version first. Refused while the plugin's Allow edits switch is off.",
} as const;

export const NODES_DELETE_FIELD = {
  nodes: 'The layers\' ids, e.g. ["54:243"].',
  deleted: "The layers deleted; in a dry run, the layers that would be.",
  errors: "The layers left, each with why.",
} as const;
