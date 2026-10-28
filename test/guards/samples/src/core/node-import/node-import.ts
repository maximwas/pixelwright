// Planted: core reads a file through Node. Refused by no-node-without-node.
import { readFileSync } from "node:fs";

export class TextFile {
  size(path: string): number {
    return readFileSync(path).length;
  }
}
