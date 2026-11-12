/** How long npm's answer for the newest Pixelwright is kept before it is asked again, on one computer. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** The longest wait for npm's answer: past it the check stays quiet until the next. */
export const UPDATE_CHECK_TIMEOUT_MS = 3000;

/** The file in the Pixelwright folder that keeps npm's last answer and when it came. */
export const UPDATE_STATE_FILE = "latest.json";

/** npm's newest version of the package, as JSON with its version. */
export const NPM_LATEST_URL = "https://registry.npmjs.org/pixelwright/latest";
