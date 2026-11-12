import type { Invocation } from "../types/cli.ts";

/**
 * How Claude Code starts the server on this platform. On native Windows npx is a .cmd file that Claude Code cannot start
 * by itself: its docs ask for `cmd /c npx …` there.
 */
export function claudeCodeInvocation(server: Invocation, platform: NodeJS.Platform): Invocation {
  return platform === "win32"
    ? {
        command: "cmd",
        args: ["/c", server.command, ...server.args],
      }
    : server;
}
