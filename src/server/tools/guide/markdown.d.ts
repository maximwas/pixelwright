/** A guide topic, imported as its text: tsdown's text loader in the bundle, the transform in vitest.config.ts in tests. */
declare module "*.md" {
  const text: string;

  export default text;
}
