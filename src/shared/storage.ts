import { normalizeSettings } from "./settings";
import type { AppSettings, LastOperation, PendingDispatch } from "./types";

const SETTINGS_KEY = "settings";
const LAST_OPERATION_KEY = "lastOperation";
const PENDING_KEY = "pendingDispatch";

export async function loadSettings(): Promise<AppSettings> {
  const values = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(values[SETTINGS_KEY]);
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
  return normalized;
}

export async function loadLastOperation(): Promise<LastOperation | null> {
  const values = await chrome.storage.local.get(LAST_OPERATION_KEY);
  return (values[LAST_OPERATION_KEY] as LastOperation | undefined) ?? null;
}

export async function saveLastOperation(operation: LastOperation): Promise<void> {
  await chrome.storage.local.set({ [LAST_OPERATION_KEY]: operation });
}

export async function loadPendingDispatch(): Promise<PendingDispatch | null> {
  const values = await chrome.storage.session.get(PENDING_KEY);
  return (values[PENDING_KEY] as PendingDispatch | undefined) ?? null;
}

export async function savePendingDispatch(pending: PendingDispatch | null): Promise<void> {
  if (pending) await chrome.storage.session.set({ [PENDING_KEY]: pending });
  else await chrome.storage.session.remove(PENDING_KEY);
}
