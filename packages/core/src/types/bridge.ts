import type * as z from "zod";
import type {
  BridgeErrorCodeSchema,
  PairingReasonSchema,
  PluginInfoSchema,
  PluginKeySchema,
  PluginToServerSchema,
  RequestMessageSchema,
  ServerToPluginSchema,
  WireErrorSchema,
} from "../schemas/bridge.ts";

export type BridgeErrorCode = z.infer<typeof BridgeErrorCodeSchema>;

export type WireError = z.infer<typeof WireErrorSchema>;

export type PluginInfo = z.infer<typeof PluginInfoSchema>;

export type RequestMessage = z.infer<typeof RequestMessageSchema>;

export type PluginToServer = z.infer<typeof PluginToServerSchema>;

export type ServerToPlugin = z.infer<typeof ServerToPluginSchema>;

export type PluginKey = z.infer<typeof PluginKeySchema>;

export type PairingReason = z.infer<typeof PairingReasonSchema>;
