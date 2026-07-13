import { deliverPrompt } from "../providers/deliver";
import { providerAdapter } from "../providers";
import { providerIdForHostname } from "../shared/providers";
import type { ProviderId, SendMode } from "../shared/types";

type BridgeWindow = Window & { __shanbayAiWordBridgeProviderLoaded?: boolean };
const bridgeWindow = window as BridgeWindow;

if (!bridgeWindow.__shanbayAiWordBridgeProviderLoaded) {
  bridgeWindow.__shanbayAiWordBridgeProviderLoaded = true;
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isDeliverMessage(message)) return false;
    const detected = providerIdForHostname(window.location.hostname);
    if (!detected || detected !== message.providerId) {
      sendResponse({ ok: false, status: "failed", providerId: message.providerId, reason: "页面与目标站点不匹配" });
      return false;
    }
    void deliverPrompt(providerAdapter(detected), {
      prompt: message.prompt,
      word: message.word,
      mode: message.mode
    }).then(sendResponse).catch((error: unknown) => {
      sendResponse({
        ok: false,
        status: "failed",
        providerId: detected,
        reason: error instanceof Error ? error.message : "适配器执行失败"
      });
    });
    return true;
  });
}

interface DeliverMessage {
  type: "BRIDGE_DELIVER_PROMPT";
  providerId: ProviderId;
  prompt: string;
  word: string;
  mode: SendMode;
}

function isDeliverMessage(value: unknown): value is DeliverMessage {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<DeliverMessage>;
  return item.type === "BRIDGE_DELIVER_PROMPT"
    && typeof item.providerId === "string"
    && typeof item.prompt === "string"
    && typeof item.word === "string"
    && (item.mode === "send" || item.mode === "fill");
}
