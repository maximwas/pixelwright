import semver from "semver";
import { CLI_TEXT, NODE_MINIMUM } from "@/cli/main/cli.constants.ts";

/** The Node gate (S-057): bin.ts asks it before anything else loads. */
export class NodeGate {
  /** What to tell a person on an older Node, or null when this one runs Pixelwright. */
  refusal(version: string): string | null {
    return semver.lt(version, NODE_MINIMUM) ? CLI_TEXT.nodeTooOld(version) : null;
  }
}
