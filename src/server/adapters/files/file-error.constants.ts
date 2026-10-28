/** Node's errno codes the file adapters act on: the file is there already, or it is not there. */
export const FILE_ERROR = { exists: "EEXIST", missing: "ENOENT" } as const;
