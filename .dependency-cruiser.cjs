// .dependency-cruiser.cjs  (pnpm check:deps, part of pnpm lint)
const SERVER_ONLY = "node_modules/(ws|pino|atomically|@modelcontextprotocol|@orpc|@clack|fast-png|pixelmatch|@jsquash|image-size|acorn|acorn-walk|fuse\\.js|semver|quickjs-emscripten-core|@jitl|p-limit)/";
const rule = (name, from, to) => ({ name, severity: "error", from, to });

module.exports = {
  forbidden: [
    rule("no-old", {}, { path: "^old/" }),
    rule("no-cycles", {}, { circular: true }),
    // An @/ import the tsconfig paths cannot resolve is invisible to every layer rule below. The guard samples map @/
    // to their own src/, which test/guards/guards.test.ts cruises from there.
    rule("no-unresolved-alias", { pathNot: "^test/guards/samples/" }, { path: "^@/", couldNotResolve: true }),
    rule("shared-is-the-floor", { path: "^src/shared/" }, { path: "^src/", pathNot: "^src/shared/" }),
    rule("core-on-shared", { path: "^src/core/" }, { path: "^src/", pathNot: "^src/(core|shared)/" }),
    rule("kernel-on-nothing", { path: "^src/core/kernel/" }, { path: "^src/core/", pathNot: "^src/core/kernel/" }),
    rule("no-node-without-node", { path: "^src/(shared|core|plugin|plugin-ui)/" }, { dependencyTypes: ["core"] }),
    rule("no-server-packages", { path: "^src/(shared|core|plugin|plugin-ui)/" }, { path: SERVER_ONLY }),
    rule("server-app", { path: "^src/server/app/" }, { path: "^src/", pathNot: "^src/(server/app|core|shared)/" }),
    rule("server-tools", { path: "^src/server/tools/" }, { path: "^src/", pathNot: "^src/(server/(app|tools)|core|shared)/" }),
    rule("tools-apart", { path: "^src/server/tools/([^/]+)/" },
      { path: "^src/server/tools/[^/]+/", pathNot: "^src/server/tools/$1/" }),
    rule("server-adapters", { path: "^src/server/adapters/" }, { path: "^src/", pathNot: "^src/(server/adapters|core|shared)/" }),
    rule("server-not-plugin", { path: "^src/(server|cli)/" }, { path: "^src/(plugin|plugin-ui)/" }),
    rule("plugin-app", { path: "^src/plugin/app/" }, { path: "^src/", pathNot: "^src/(plugin/app|core|shared)/" }),
    rule("plugin-adapters", { path: "^src/plugin/adapters/" }, { path: "^src/", pathNot: "^src/(plugin/adapters|core|shared)/" }),
    rule("plugin-operations", { path: "^src/plugin/operations/" },
      { path: "^src/", pathNot: "^src/(plugin/(app|operations|adapters/figma)|core|shared)/" }),
    rule("operations-apart", { path: "^src/plugin/operations/([^/]+)/" },
      { path: "^src/plugin/operations/[^/]+/", pathNot: "^src/plugin/operations/$1/" }),
    rule("plugin-not-server", { path: "^src/plugin/" }, { path: "^src/(server|cli|plugin-ui)/" }),
    rule("plugin-no-server-core", { path: "^src/plugin/" }, { path: "^src/core/(xml|design|checks|diff|images)/" }),
    rule("ui-on-shared", { path: "^src/plugin-ui/" }, { path: "^src/", pathNot: "^src/(plugin-ui|shared)/" }),
    rule("src-not-tests", { path: "^src/" }, { path: "^test/" }),
  ],
  options: {
    doNotFollow: { path: ["node_modules", "^old/"] },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
