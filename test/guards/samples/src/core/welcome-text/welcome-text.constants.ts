// Clean: texts live here, a text with values as a constant arrow; the class-module bans let the arrow through.
export const WELCOME_TEXT = {
  hello: "hello",
  named: (name: string) => `hello ${name}`,
} as const;
