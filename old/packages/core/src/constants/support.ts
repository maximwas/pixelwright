import type { SupportLink } from "../types/support.ts";

/**
 * Where people can support the project with a one-time donation: Ko-fi first (cards and PayPal, for supporters abroad),
 * then a monobank jar (any Visa or Mastercard). GitHub Sponsors does not pay out in Ukraine. The server's weekly note
 * and the plugin window's links both come from here; the plugin opens no other address but FEEDBACK_LINK.
 */
export const SUPPORT_LINKS: readonly SupportLink[] = [
  {
    label: "Ko-fi",
    url: "https://ko-fi.com/maksymvasianin",
  },
  {
    label: "monobank",
    url: "https://send.monobank.ua/jar/7o9oMrbXTj",
  },
];

/** Where people tell what works, what does not and what they need: the repository's discussions. */
export const FEEDBACK_LINK: SupportLink = {
  label: "GitHub",
  url: "https://github.com/maximwas/pixelwright/discussions",
};

/** The README's steps to update Pixelwright, which the plugin window links when a newer version is out. */
export const UPDATE_GUIDE_LINK = "https://github.com/maximwas/pixelwright#updating";

/** The website's changelog page: one section a version, `#v0-3-2`. */
const CHANGELOG_PAGE = "https://maximwas.github.io/pixelwright/changelog/";

/** A version's section of the website's changelog. */
export function changelogLink(version: string): string {
  return `${CHANGELOG_PAGE}#v${version.replaceAll(".", "-")}`;
}

/** Whether the plugin may open an address for an update: the README's steps or a version's changes, nothing else. */
export function isUpdateLink(url: string): boolean {
  const section = url.startsWith(`${CHANGELOG_PAGE}#v`) ? url.slice(CHANGELOG_PAGE.length + 2) : null;

  return url === UPDATE_GUIDE_LINK || (section !== null && /^\d+-\d+-\d+$/.test(section));
}
