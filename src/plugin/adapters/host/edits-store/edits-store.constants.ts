/** The clientStorage key of one file's Allow edits (P-011): per user, machine and plugin id, so never shared. */
export const EDITS_KEY = {
  of: (fileId: string) => `pixelwright.allowEdits.${fileId}`,
} as const;
