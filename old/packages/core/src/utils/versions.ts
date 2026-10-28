import gt from "semver/functions/gt.js";
import prerelease from "semver/functions/prerelease.js";
import valid from "semver/functions/valid.js";

/** Whether a released version is newer than another, in semver's order; never a prerelease, nor one it cannot read. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return (
    valid(candidate) !== null && valid(current) !== null && prerelease(candidate) === null && gt(candidate, current)
  );
}
