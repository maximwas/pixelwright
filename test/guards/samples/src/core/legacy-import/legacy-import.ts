// Planted: new code reaches into old/. Refused by no-old.
import { legacyName } from "../../../old/legacy.ts";

export class CurrentName {
  read(): string {
    return legacyName();
  }
}
