// The package's own name: package.json exports only itself, so no climb out of src is needed.
import packageJson from "pixelwright/package.json" with { type: "json" };

/** The one version source (D-02): server, CLI and plugin ship together in one package. */
export const VERSION = packageJson.version;
