// Planted: inject() inside a method, a service locator. Refused by no-restricted-syntax (inject() only as a constructor
// default parameter).
import { InjectionToken, inject } from "@needle-di/core";

const NAME = new InjectionToken<string>("Name");

export class Greeting {
  text(): string {
    return `hello ${inject(NAME)}`;
  }
}
