import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { cruise } from "dependency-cruiser";
import extractDepcruiseOptions from "dependency-cruiser/config-utl/extract-depcruise-options";
import { ESLint, type Linter } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

// The repo's own ESLint and dependency-cruiser configs run over samples/ as if it were the repo root, so samples/src/x
// is judged as src/x. Each planted file must be refused by exactly its rules: a rule removed or weakened fails a case.
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SAMPLES = fileURLToPath(new URL("samples/", import.meta.url));

const EXPECTED: Record<string, string[]> = {
  "src/core/node-import.ts": ["no-node-without-node"],
  "src/core/legacy-import.ts": ["no-old"],
  "src/core/tokens/token-name.ts": ["core-domains-by-index"],
  "src/server/tools/alpha/alpha.tool.ts": ["tools-apart"],
  "src/plugin/operations/xml-read/xml-read.operation.ts": ["plugin-no-server-core"],
  "src/plugin/operations/node-read/node-read.operation.ts": ["no-restricted-globals", "no-restricted-syntax"],
  "src/plugin/adapters/figma/css-of.ts": ["no-restricted-syntax"],
  "src/plugin/adapters/figma/current-page.ts": ["@figma/figma-plugins/ban-deprecated-sync-prop-setters"],
  "src/core/geometry/point.schema.ts": ["no-restricted-imports"],
  "src/core/long-function.ts": ["max-lines-per-function"],
  "src/core/is-on.ts": ["no-restricted-syntax"],
  "src/core/counter.ts": ["no-restricted-syntax"],
  // Targets of the planted imports: clean themselves.
  "src/server/tools/beta/beta.tool.ts": [],
  "src/core/xml/index.ts": [],
  "src/core/kernel/names/slug.ts": [],
};

/** The repo's ESLint config; project-structure takes its root from the folder above node_modules, so it moves here. */
async function samplesConfig(): Promise<Linter.Config[]> {
  const projectRoot = relative(ROOT, SAMPLES);
  const repoConfig: { default: Linter.Config[] } = await import(`${ROOT}eslint.config.js`);

  return repoConfig.default.map((entry) => {
    if (entry.rules === undefined) {
      return entry;
    }

    const rules = Object.entries(entry.rules).map(([name, setting]) =>
      name.startsWith("project-structure/") && Array.isArray(setting)
        ? [name, [setting[0], Object.assign({}, setting[1], { projectRoot })]]
        : [name, setting],
    );

    return {
      ...entry,
      rules: Object.fromEntries(rules),
    };
  });
}

async function eslintFindings(): Promise<Map<string, Set<string>>> {
  const eslint = new ESLint({
    cwd: SAMPLES,
    overrideConfigFile: true,
    baseConfig: await samplesConfig(),
  });
  const findings = new Map<string, Set<string>>();

  for (const result of await eslint.lintFiles(["src"])) {
    const rules = result.messages.map((message) => message.ruleId ?? `fatal: ${message.message}`);

    findings.set(relative(SAMPLES, result.filePath), new Set(rules));
  }

  return findings;
}

async function addDepcruiseFindings(findings: Map<string, Set<string>>): Promise<void> {
  const options = await extractDepcruiseOptions(`${ROOT}.dependency-cruiser.cjs`);
  const { output } = await cruise(["src"], {
    ...options,
    baseDir: SAMPLES,
  });

  if (typeof output === "string") {
    throw new Error(`dependency-cruiser returned text: ${output}`);
  }

  for (const violation of output.summary.violations) {
    const rules = findings.get(violation.from) ?? new Set<string>();

    findings.set(violation.from, rules.add(violation.rule.name));
  }
}

describe("guard rails refuse each planted sample with exactly its rules", () => {
  let found = new Map<string, string[]>();

  beforeAll(async () => {
    const findings = await eslintFindings();

    await addDepcruiseFindings(findings);
    found = new Map([...findings].map(([file, rules]) => [file, [...rules].sort()]));
  });

  it("checks exactly the planted files", () => {
    expect([...found.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))("%s", (file, rules) => {
    expect(found.get(file)).toEqual([...rules].sort());
  });
});
