import { InjectionToken } from "@needle-di/core";
import type { ServerRpc } from "@/plugin/adapters/host/server-rpc/server-rpc.ts";

export const SERVER_RPC = new InjectionToken<ServerRpc>("ServerRpc");
