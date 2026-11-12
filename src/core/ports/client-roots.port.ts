import { InjectionToken } from "@needle-di/core";

/** The folders the MCP client works in (roots/list, T-008): their URIs, file ones and others. */
export interface ClientRoots {
  /** The client's root URIs, asked once and again after it says they changed; none when it lists none. */
  uris(): Promise<readonly string[]>;
}

export const CLIENT_ROOTS = new InjectionToken<ClientRoots>("ClientRoots");
