import { InjectionToken } from "@needle-di/core";
import type { SocketLink } from "@/plugin-ui/link/socket-link/socket-link.ts";
import type { SocketOpener } from "@/plugin-ui/link/socket-link/socket-link.types.ts";

export const SOCKET_LINK = new InjectionToken<SocketLink>("SocketLink");

export const SOCKET_OPENER = new InjectionToken<SocketOpener>("SocketOpener");
