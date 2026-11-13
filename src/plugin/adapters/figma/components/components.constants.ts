/** Why 10 s: Figma never settles a set import of a key that is no published set (FX-017); a library answered in 269 ms. */
export const COMPONENT_LIMIT = { keyImportMs: 10_000, msPerSecond: 1_000 } as const;

export const COMPONENT_VALUE = {
  /** A library component the file does not use yet is named by its key: component="key:<key>". */
  keyPrefix: "key:",
  variantPair: (name: string, value: string) => `${name}=${value}`,
  variantJoint: ", ",
  variantsJoint: "; ",
} as const;

export const COMPONENT_TEXT = {
  notImported: (key: string, why: string) => `Figma did not import key:${key}: ${why}`,
  notImportedHint:
    "Only components of a published library this account can use import by key (library_search finds them); in the library file itself, name the component instead.",
  noAnswer: (seconds: number) => `no answer in ${seconds} s.`,
  notFound: (name: string) =>
    `No component or component set is named ${name} in this file or the libraries its page uses.`,
  notFoundHint: 'components_read lists them; a library one the file does not use yet takes component="key:<key>".',
  near: (near: string) => `Did you mean ${near}?`,
  noVariants: (name: string) => `${name} is a component without variants: give no variant.`,
  noVariant: (
    name: string,
    wanted: string,
    has: string,
  ) => `${name} has no variant ${wanted}: it has ${has}.`,
} as const;
