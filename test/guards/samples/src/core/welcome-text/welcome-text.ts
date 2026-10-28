// Planted: texts written in code instead of a .constants.ts. Refused by shape/no-string-literal (the string),
// shape/no-string-type (the hand-written string type) and shape/no-text-template (the template with text).
type Greeting = "hello";

export class WelcomeText {
  text(name: string): string {
    const greeting: Greeting = "hello";

    return `${greeting} ${name}`;
  }
}
