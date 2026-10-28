// Planted: an @/ import nothing resolves, so no layer rule could see where it goes. Refused by no-unresolved-alias.
import { Nowhere } from "@/core/nowhere/nowhere.ts";

export class LostImport {
  read(): number {
    return new Nowhere().size();
  }
}
