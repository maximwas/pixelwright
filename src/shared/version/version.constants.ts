import packageJson from "../../../package.json" with { type: "json" };

/** The one version source (D-02): server, CLI and plugin ship together in one package. */
export const VERSION = packageJson.version;
