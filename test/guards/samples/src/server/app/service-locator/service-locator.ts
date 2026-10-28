// Planted: inject() inside a method, a service locator. Refused by no-restricted-syntax (inject() only as a constructor
// default parameter). Its token's description is a debug name, which shape/no-string-literal lets through.
import { InjectionToken, inject } from "@needle-di/core";

const NAME = new InjectionToken<string>("Name");

export class Greeting {
  text(): string {
    return inject(NAME);
  }
}
