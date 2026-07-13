export const PROVIDER_IDS = ["gemini", "chatgpt", "doubao", "kimi"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type SendMode = "send" | "fill";

export type DeliveryStatus =
  | "sent"
  | "filled"
  | "not_ready"
  | "not_submitted"
  | "submission_unknown"
  | "permission_missing"
  | "failed";

export type OperationStatus = DeliveryStatus | "copied" | "copy_failed" | "awaiting_priority";

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  shortName: string;
  origins: string[];
  matches: string[];
  hostnames: string[];
  color: string;
}

export interface ProviderSettings {
  id: ProviderId;
  enabled: boolean;
  priority: number;
  mode: SendMode;
  preferredUrl: string;
}

export interface AppSettings {
  schemaVersion: 1;
  promptTemplate: string;
  providers: ProviderSettings[];
}

export interface ProviderRuntimeState {
  id: ProviderId;
  permissionGranted: boolean;
  open: boolean;
  tabId?: number;
  tabUrl?: string;
}

export interface DeliveryResult {
  ok: boolean;
  status: DeliveryStatus;
  providerId: ProviderId;
  reason?: string;
  verifiedBy?: "message" | "editor_cleared";
}

export interface LastOperation {
  word: string;
  prompt: string;
  providerId?: ProviderId;
  status: OperationStatus;
  message: string;
  occurredAt: string;
}

export interface PendingDispatch {
  id: string;
  word: string;
  prompt: string;
  shanbayTabId: number;
  failedProviders: ProviderId[];
  createdAt: string;
}

export interface ProviderTabLike {
  id?: number;
  url?: string;
  lastAccessed?: number;
}

export interface PriorityDialogProvider {
  id: ProviderId;
  name: string;
  enabled: boolean;
  permissionGranted: boolean;
  open: boolean;
  failed: boolean;
}
