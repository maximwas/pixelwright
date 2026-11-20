import { InjectionToken, injectable } from "@needle-di/core";
import { isEqual } from "es-toolkit";

/** Fields of a node to set; one left undefined is not set. */
export type Fields<Node> = { [Key in keyof Node]?: Node[Key] | undefined };

/** Sets a node's fields only where the value differs (P-080): Figma records every set as a change, of the same value too. */
@injectable()
export class Assign {
  /** In the order given: a field Figma reads another by (layoutMode before padding) comes first. */
  set<Node extends object>(node: Node, fields: Fields<Node>): void {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && !isEqual(Reflect.get(node, key), value)) {
        Reflect.set(node, key, value);
      }
    }
  }
}

export const ASSIGN = new InjectionToken<Assign>("Assign");
