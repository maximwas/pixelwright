// Planted: inject() given a class instead of a token: a child container would build a second instance (needle-di #110).
// Refused by no-restricted-syntax.
import { inject } from "@needle-di/core";
import { Greeting } from "./service-locator.ts";

export class Welcome {
  readonly #greeting: Greeting;

  constructor(greeting = inject(Greeting)) {
    this.#greeting = greeting;
  }

  text(): string {
    return this.#greeting.text();
  }
}
