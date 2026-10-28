// Planted: core reads a file through Node. Refused by no-node-without-node.
import { readFileSync } from "node:fs";

export class TextFile {
  read(path: string): string {
    return readFileSync(path, "utf8");
  }
}
