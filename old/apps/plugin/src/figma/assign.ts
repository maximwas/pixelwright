import { sameValue } from "@pixelwright/core";

/** Sets a node's field when the value differs: Figma records every set as a change, even of the value it holds. */
export function assign<N extends object, K extends keyof N>(node: N, key: K, value: N[K]): void {
  if (!sameValue(node[key], value)) {
    node[key] = value;
  }
}
