import { PROVIDERS, providerDefinition } from "./shared/providers";
import { nextProvider, selectProviderTab } from "./shared/routing";
import { applyProviderOrder, buildPrompt, normalizeSettings } from "./shared/settings";
import { shouldOfferReroute } from "./shared/delivery-policy";
import { isRecentDuplicate } from "./shared/dedupe";
import {
  loadPendingDispatch,
  loadSettings,
  saveLastOperation,
  savePendingDispatch,
  saveSettings
} from "./shared/storage";
import type {
  AppSettings,
  DeliveryResult,
  PendingDispatch,
  PriorityDialogProvider,
  ProviderId,
  ProviderRuntimeState
} from "./shared/types";

const SHANBAY_PATTERN = "https://web.shanbay.com/*";
let lastCapture: { word: string; at: number } | null = null;
let scriptSyncChain: Promise<void> = Promise.resolve();

chrome.runtime.onInstalled.addListener((details) => {
  void initialize(details.reason === "install");
});
chrome.runtime.onStartup.addListener(() => { void initialize(false); });
chrome.permissions.onAdded.addListener(() => { void syncProviderScripts(); });
chrome.permissions.onRemoved.addListener(() => { void syncProviderScripts(); });

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-word") void captureFromActiveTab();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isRecord(message) || typeof message.type !== "string") return false;
  void handleMessage(message, sender)
    .then((result) => sendResponse(result ?? { ok: true }))
    .catch((error: unknown) => sendResponse({ ok: false, reason: error instanceof Error ? error.message : "后台执行失败" }));
  return true;
});

async function initialize(openOptions: boolean): Promise<void> {
  const settings = await loadSettings();
  await saveSettings(settings);
  await syncProviderScripts(settings);
  if (openOptions) await chrome.runtime.openOptionsPage();
}

async function handleMessage(message: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "BRIDGE_WORD_CAPTURED": {
      const tabId = sender.tab?.id;
      if (typeof tabId !== "number") throw new Error("无法确定扇贝标签页。");
      return processWord(String(message.word ?? ""), tabId);
    }
    case "BRIDGE_PRIORITY_CONFIRMED":
      return confirmPriority(String(message.dispatchId ?? ""), asProviderIds(message.orderedIds));
    case "BRIDGE_PRIORITY_CANCELLED":
      return cancelPriority(String(message.dispatchId ?? ""));
    case "BRIDGE_GET_SETTINGS":
      return { settings: await loadSettings() };
    case "BRIDGE_SAVE_SETTINGS": {
      const settings = await saveSettings(normalizeSettings(message.settings));
      await syncProviderScripts(settings);
      return { settings, states: await getProviderRuntimeStates(settings) };
    }
    case "BRIDGE_GET_PROVIDER_STATES": {
      const settings = await loadSettings();
      return { states: await getProviderRuntimeStates(settings) };
    }
    case "BRIDGE_SETTINGS_UPDATED":
      await syncProviderScripts();
      return { ok: true };
    default:
      return null;
  }
}

async function captureFromActiveTab(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== "number" || !tab.url?.startsWith("https://web.shanbay.com/")) return;
  let response: { word?: string } | undefined;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "BRIDGE_CAPTURE_WORD" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["shanbay.js"] });
    response = await chrome.tabs.sendMessage(tab.id, { type: "BRIDGE_CAPTURE_WORD" });
  }
  if (response?.word) await processWord(response.word, tab.id);
  else await showToast(tab.id, "没有识别到当前单词，可先选中后重试", "warning");
}

async function processWord(rawWord: string, shanbayTabId: number): Promise<{ status: string }> {
  const word = rawWord.trim();
  if (!word) throw new Error("单词不能为空。");
  const now = Date.now();
  if (isRecentDuplicate(lastCapture, word, now)) return { status: "deduplicated" };
  lastCapture = { word, at: now };

  const settings = await loadSettings();
  const prompt = buildPrompt(settings.promptTemplate, word);
  const pending: PendingDispatch = {
    id: crypto.randomUUID(),
    word,
    prompt,
    shanbayTabId,
    failedProviders: [],
    createdAt: new Date().toISOString()
  };
  await savePendingDispatch(pending);
  await routePending(pending, settings);
  return { status: "processed" };
}

async function routePending(pending: PendingDispatch, settings: AppSettings): Promise<void> {
  const states = await getProviderRuntimeStates(settings);
  const target = nextProvider(settings, states, pending.failedProviders);
  if (!target || typeof target.tabId !== "number") {
    await copyPending(pending, "没有已打开且已授权的 AI 网页，已复制完整提问");
    return;
  }

  const providerSettings = settings.providers.find((item) => item.id === target.id);
  if (!providerSettings) {
    await copyPending(pending, "站点配置缺失，已复制完整提问");
    return;
  }

  const result = await deliverToProvider(target.tabId, target.id, pending, providerSettings.mode);
  if (result.status === "sent" || result.status === "filled") {
    const providerName = providerDefinition(target.id).shortName;
    const action = result.status === "sent" ? "已发送" : "已填入";
    await saveLastOperation({
      word: pending.word,
      prompt: pending.prompt,
      providerId: target.id,
      status: result.status,
      message: `${action}到 ${providerName}`,
      occurredAt: new Date().toISOString()
    });
    await savePendingDispatch(null);
    await showToast(pending.shanbayTabId, `${action}到 ${providerName}：${pending.word}`);
    return;
  }

  if (shouldOfferReroute(result.status)) {
    const failedProviders = [...new Set([...pending.failedProviders, target.id])];
    const updated = { ...pending, failedProviders };
    await savePendingDispatch(updated);
    await saveLastOperation({
      word: pending.word,
      prompt: pending.prompt,
      providerId: target.id,
      status: "awaiting_priority",
      message: `${providerDefinition(target.id).shortName} 未提交，等待调整优先级`,
      occurredAt: new Date().toISOString()
    });
    await showPriorityDialog(updated, settings, states, target.id, result.reason ?? "页面未就绪");
    return;
  }

  const warning = result.status === "submission_unknown"
    ? `${providerDefinition(target.id).shortName} 的提交结果不确定，为避免重复发送，已复制完整提问`
    : `${providerDefinition(target.id).shortName} 发送失败，已复制完整提问`;
  await copyPending(pending, warning, target.id, result.status);
}

async function deliverToProvider(
  tabId: number,
  providerId: ProviderId,
  pending: PendingDispatch,
  mode: "send" | "fill"
): Promise<DeliveryResult> {
  const message = { type: "BRIDGE_DELIVER_PROMPT", providerId, prompt: pending.prompt, word: pending.word, mode };
  try {
    const result = await chrome.tabs.sendMessage(tabId, message);
    if (isDeliveryResult(result)) return result;
    return { ok: false, status: "submission_unknown", providerId, reason: "页面没有返回可验证结果" };
  } catch (error) {
    // Only a definite missing receiver is safe to retry. Other transport errors may occur after submission.
    if (!isMissingReceiverError(error)) {
      return {
        ok: false,
        status: "submission_unknown",
        providerId,
        reason: error instanceof Error ? error.message : "站点响应中断"
      };
    }
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["provider.js"] });
  } catch (error) {
    return {
      ok: false,
      status: "not_ready",
      providerId,
      reason: error instanceof Error ? error.message : "无法注入站点适配器"
    };
  }
  try {
    const result = await chrome.tabs.sendMessage(tabId, message);
    if (isDeliveryResult(result)) return result;
    return { ok: false, status: "submission_unknown", providerId, reason: "页面没有返回可验证结果" };
  } catch (error) {
    return {
      ok: false,
      status: "submission_unknown",
      providerId,
      reason: error instanceof Error ? error.message : "适配器执行后响应中断"
    };
  }
}

async function confirmPriority(dispatchId: string, orderedIds: ProviderId[]): Promise<{ ok: boolean }> {
  const pending = await loadPendingDispatch();
  if (!pending || pending.id !== dispatchId) return { ok: false };
  const settings = applyProviderOrder(await loadSettings(), orderedIds);
  await saveSettings(settings);
  await syncProviderScripts(settings);
  await routePending(pending, settings);
  return { ok: true };
}

async function cancelPriority(dispatchId: string): Promise<{ ok: boolean }> {
  const pending = await loadPendingDispatch();
  if (!pending || pending.id !== dispatchId) return { ok: false };
  await copyPending(pending, "已取消改投，完整提问已复制");
  return { ok: true };
}

async function copyPending(
  pending: PendingDispatch,
  message: string,
  providerId?: ProviderId,
  sourceStatus?: DeliveryResult["status"]
): Promise<void> {
  let copied = false;
  try {
    const response = await chrome.tabs.sendMessage(pending.shanbayTabId, { type: "BRIDGE_COPY_TEXT", text: pending.prompt });
    copied = Boolean(response?.ok);
  } catch {
    copied = false;
  }
  await saveLastOperation({
    word: pending.word,
    prompt: pending.prompt,
    providerId,
    status: copied ? "copied" : "copy_failed",
    message: copied ? message : `${message}；自动复制失败，请从扩展弹窗复制`,
    occurredAt: new Date().toISOString()
  });
  await savePendingDispatch(null);
  await showToast(
    pending.shanbayTabId,
    copied ? message : "自动复制失败，请点击扩展图标复制完整提问",
    sourceStatus === "submission_unknown" || !copied ? "warning" : "normal"
  );
}

async function showPriorityDialog(
  pending: PendingDispatch,
  settings: AppSettings,
  states: ProviderRuntimeState[],
  failedProviderId: ProviderId,
  reason: string
): Promise<void> {
  const stateMap = new Map(states.map((item) => [item.id, item]));
  const providers: PriorityDialogProvider[] = [...settings.providers]
    .sort((left, right) => left.priority - right.priority)
    .map((item) => ({
      id: item.id,
      name: providerDefinition(item.id).name,
      enabled: item.enabled,
      permissionGranted: stateMap.get(item.id)?.permissionGranted ?? false,
      open: stateMap.get(item.id)?.open ?? false,
      failed: pending.failedProviders.includes(item.id)
    }));
  try {
    await chrome.tabs.sendMessage(pending.shanbayTabId, {
      type: "BRIDGE_SHOW_PRIORITY_DIALOG",
      dispatchId: pending.id,
      failedProviderName: providerDefinition(failedProviderId).shortName,
      reason,
      providers
    });
  } catch {
    await copyPending(pending, "无法显示优先级调整界面，已复制完整提问", failedProviderId);
  }
}

async function getProviderRuntimeStates(settings: AppSettings): Promise<ProviderRuntimeState[]> {
  return Promise.all(PROVIDERS.map(async (definition) => {
    const permissionGranted = await chrome.permissions.contains({ origins: definition.origins });
    if (!permissionGranted) return { id: definition.id, permissionGranted, open: false };
    const tabs = await chrome.tabs.query({ url: definition.matches });
    const preferredUrl = settings.providers.find((item) => item.id === definition.id)?.preferredUrl ?? "";
    const selected = selectProviderTab(tabs, preferredUrl);
    return {
      id: definition.id,
      permissionGranted,
      open: Boolean(selected),
      tabId: selected?.id,
      tabUrl: selected?.url
    };
  }));
}

function syncProviderScripts(settings?: AppSettings): Promise<void> {
  const run = scriptSyncChain.then(() => performProviderScriptSync(settings));
  scriptSyncChain = run.catch(() => undefined);
  return run;
}

async function performProviderScriptSync(settings?: AppSettings): Promise<void> {
  const currentSettings = settings ?? await loadSettings();
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const bridgeIds = existing.map((item) => item.id).filter((id) => id.startsWith("shanbay-ai-provider-"));
  if (bridgeIds.length) await chrome.scripting.unregisterContentScripts({ ids: bridgeIds });

  const registrations: chrome.scripting.RegisteredContentScript[] = [];
  for (const definition of PROVIDERS) {
    const configured = currentSettings.providers.find((item) => item.id === definition.id);
    if (!configured?.enabled) continue;
    if (!await chrome.permissions.contains({ origins: definition.origins })) continue;
    registrations.push({
      id: `shanbay-ai-provider-${definition.id}`,
      matches: definition.matches,
      js: ["provider.js"],
      runAt: "document_idle",
      persistAcrossSessions: true
    });
  }
  if (registrations.length) await chrome.scripting.registerContentScripts(registrations);
}

async function showToast(tabId: number, text: string, tone: "normal" | "warning" = "normal"): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "BRIDGE_SHOW_TOAST", text, tone });
  } catch {
    // The result remains available in the popup even if the source tab closed.
  }
}

function asProviderIds(value: unknown): ProviderId[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProviderId => typeof item === "string" && PROVIDERS.some((provider) => provider.id === item));
}

function isDeliveryResult(value: unknown): value is DeliveryResult {
  if (!isRecord(value)) return false;
  return typeof value.ok === "boolean" && typeof value.status === "string" && typeof value.providerId === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingReceiverError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /receiving end does not exist|could not establish connection/i.test(message);
}

void initialize(false);
