import { InjectionToken, inject, injectable } from "@needle-di/core";
import { PLUGIN_LINK } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { OP_CALL_STEPS } from "@/server/app/sessions/plugin-session/plugin-session.tokens.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session/plugin-session.ts";
import { TARGET_RESOLVER } from "@/server/app/sessions/target-resolver/target-resolver.ts";

/** Factory of plugin sessions (A§6.1 steps 2-3): resolves a call's `file` once and binds a session to it. */
@injectable()
export class PluginSessions {
  readonly #link;
  readonly #resolver;
  readonly #steps;

  constructor(
    link = inject(PLUGIN_LINK),
    resolver = inject(TARGET_RESOLVER),
    steps = inject(OP_CALL_STEPS, { multi: true }),
  ) {
    this.#link = link;
    this.#resolver = resolver;
    this.#steps = steps;
  }

  /** The session of `file` (a session id or a name, any case), else the active file's (T-001). */
  session(file: string | undefined): PluginSession {
    return new PluginSession(this.#resolver.resolve(this.#link.files(), file), this.#link, this.#steps);
  }
}

export const PLUGIN_SESSIONS = new InjectionToken<PluginSessions>("PluginSessions");
