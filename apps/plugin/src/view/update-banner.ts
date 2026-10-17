import { changelogLink, isNewerVersion, UPDATE_GUIDE_LINK } from "@pixelwright/core";

/** The banner over the window when npm has a newer Pixelwright: its words and where its two links go. */
export interface UpdateBanner {
  readonly version: string;
  readonly text: string;
  /** That version's section of the website's changelog. */
  readonly changes: string;
  /** The README's steps to update. */
  readonly guide: string;
}

/**
 * The banner for npm's newest version: shown while it is newer than this plugin and than the version whose banner the
 * user closed, so a closed one comes back only with the next version.
 */
export function updateBanner({
  latest,
  pluginVersion,
  dismissed,
}: {
  readonly latest: string | null;
  readonly pluginVersion: string;
  readonly dismissed: string | null;
}): UpdateBanner | null {
  if (latest === null || !isNewerVersion(latest, pluginVersion)) {
    return null;
  }

  if (dismissed !== null && !isNewerVersion(latest, dismissed)) {
    return null;
  }

  return {
    version: latest,
    text: `Pixelwright ${latest} is out`,
    changes: changelogLink(latest),
    guide: UPDATE_GUIDE_LINK,
  };
}
