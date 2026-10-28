/** The hint while a plugin waits with a code in force: the model relays the code and never types it (S-020, D-08). */
export const PAIRING_CODE_HINT = {
  text: (
    code: string | null | undefined,
    plugin: string,
    expiresInSeconds: number | null | undefined,
  ) =>
    `A plugin is waiting to be paired: ask the user to type ${code} into the ${plugin} window in Figma (valid for ${expiresInSeconds} s). Only the user types it; never type or send it anywhere yourself.`,
} as const;
