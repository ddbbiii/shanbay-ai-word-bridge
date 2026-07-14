import type { PriorityDialogProvider, ProviderId } from "../shared/types";
import { isRecentDuplicate } from "../shared/dedupe";
import { DEFAULT_SHORTCUT, matchesShortcut } from "../shared/shortcut";
import { normalizeSettings } from "../shared/settings";
import type { ShortcutSettings } from "../shared/types";

type BridgeWindow = Window & { __shanbayAiWordBridgeLoaded?: boolean };
const bridgeWindow = window as BridgeWindow;
const IGNORED_WORDS = new Set([
  "shanbay", "words", "study", "review", "start", "next", "known", "unknown", "continue", "settings"
]);
let lastTriggerAt = 0;
let lastTriggeredWord = "";
let configuredShortcut: ShortcutSettings = { ...DEFAULT_SHORTCUT };

if (!bridgeWindow.__shanbayAiWordBridgeLoaded) {
  bridgeWindow.__shanbayAiWordBridgeLoaded = true;
  void refreshShortcut();
  window.addEventListener("keydown", handleShortcut, true);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.settings) {
      configuredShortcut = normalizeSettings(changes.settings.newValue).shortcut;
    }
  });
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isRecord(message)) return false;
    if (message.type === "BRIDGE_CAPTURE_WORD") {
      sendResponse({ word: captureCurrentWord(), diagnostics: captureDiagnostics() });
      return false;
    }
    if (message.type === "BRIDGE_SHOW_TOAST") {
      showToast(String(message.text ?? ""), message.tone === "warning" ? "warning" : "normal");
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "BRIDGE_COPY_TEXT") {
      void copyText(String(message.text ?? "")).then((ok) => sendResponse({ ok }));
      return true;
    }
    if (message.type === "BRIDGE_SHOW_PRIORITY_DIALOG" && isPriorityDialogMessage(message)) {
      showPriorityDialog(message);
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });
}

function handleShortcut(event: KeyboardEvent): void {
  if (!isBridgeShortcut(event) || event.repeat || isTypingTarget(event.target)) return;
  event.preventDefault();
  event.stopPropagation();
  triggerCapture();
}

function triggerCapture(): void {
  const word = captureCurrentWord();
  if (!word) {
    showToast("没有识别到当前单词，可先选中单词后重试", "warning");
    return;
  }
  const now = Date.now();
  if (isRecentDuplicate(lastTriggerAt ? { word: lastTriggeredWord, at: lastTriggerAt } : null, word, now)) return;
  lastTriggeredWord = word;
  lastTriggerAt = now;
  void chrome.runtime.sendMessage({ type: "BRIDGE_WORD_CAPTURED", word });
}

export function captureCurrentWord(root: Document = document): string {
  const selected = normalizeWord(root.getSelection?.()?.toString() ?? window.getSelection()?.toString() ?? "");
  if (selected) return selected;

  const stableSelectors = [
    "[data-testid='word']",
    "[data-testid*='current-word' i]",
    "[data-testid*='word-title' i]",
    "[class*='current-word' i]",
    "[class*='word-title' i]",
    "[class*='Word_word']",
    "main h1",
    "main h2"
  ];
  for (const selector of stableSelectors) {
    for (const element of Array.from(root.querySelectorAll(selector)).slice(0, 40)) {
      const word = normalizeWord(element.textContent ?? "");
      if (word && !isIgnoredWord(word) && isVisible(element)) return word;
    }
  }

  const candidates: Array<{ word: string; score: number }> = [];
  const fallbackElements = Array.from(root.querySelectorAll("[class*='word' i], [data-testid], main h1, main h2, main h3")).slice(0, 400);
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  for (const element of fallbackElements) {
    const word = normalizeWord(element.textContent ?? "");
    if (!word || isIgnoredWord(word) || !isVisible(element)) continue;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize) || 0;
    const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    const areaRatio = (rect.width * rect.height) / viewportArea;
    const verticalDistance = Math.abs(rect.top - window.innerHeight * 0.34) / Math.max(1, window.innerHeight);
    const centerScore = (1 - Math.min(1, verticalDistance)) * 30;
    const compactPenalty = areaRatio > 0.35 ? 60 : 0;
    candidates.push({ word, score: fontSize * 2 + fontWeight / 100 + centerScore - compactPenalty });
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.word ?? "";
}

function captureDiagnostics(): { url: string; candidateCount: number } {
  return {
    url: window.location.href,
    candidateCount: document.querySelectorAll("[class*='word' i], [data-testid], main h1, main h2, main h3").length
  };
}

export function normalizeWord(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const match = normalized.match(/^[A-Za-z][A-Za-z'-]{0,39}(?:\s+[A-Za-z][A-Za-z'-]{0,39}){0,4}$/);
  return match ? match[0].toLowerCase() : "";
}

function isIgnoredWord(word: string): boolean {
  return IGNORED_WORDS.has(word.toLowerCase());
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 8 && rect.height > 8
    && rect.bottom > 0 && rect.right > 0
    && rect.top < window.innerHeight && rect.left < window.innerWidth
    && style.display !== "none" && style.visibility !== "hidden";
}

function isBridgeShortcut(event: KeyboardEvent): boolean {
  return matchesShortcut(event, configuredShortcut);
}

async function refreshShortcut(): Promise<void> {
  try {
    const values = await chrome.storage.local.get("settings");
    configuredShortcut = normalizeSettings(values.settings).shortcut;
  } catch {
    configuredShortcut = { ...DEFAULT_SHORTCUT };
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
}

async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function showToast(message: string, tone: "normal" | "warning" = "normal"): void {
  document.querySelector("#shanbay-ai-word-bridge-toast")?.remove();
  const toast = document.createElement("div");
  toast.id = "shanbay-ai-word-bridge-toast";
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483647",
    maxWidth: "360px",
    padding: "12px 15px",
    border: tone === "warning" ? "1px solid #f0c275" : "1px solid rgba(255,255,255,.16)",
    borderRadius: "12px",
    background: tone === "warning" ? "#fff8e9" : "#132420",
    color: tone === "warning" ? "#7a4a00" : "#fff",
    font: "600 14px/1.45 system-ui, 'Microsoft YaHei', sans-serif",
    boxShadow: "0 14px 36px rgba(14, 31, 27, .22)"
  });
  document.documentElement.appendChild(toast);
  window.setTimeout(() => toast.remove(), tone === "warning" ? 4200 : 2200);
}

interface PriorityDialogMessage {
  type: "BRIDGE_SHOW_PRIORITY_DIALOG";
  dispatchId: string;
  failedProviderName: string;
  reason: string;
  providers: PriorityDialogProvider[];
}

function showPriorityDialog(message: PriorityDialogMessage): void {
  document.querySelector("#shanbay-ai-word-bridge-priority")?.remove();
  let providers = [...message.providers];
  const host = document.createElement("div");
  host.id = "shanbay-ai-word-bridge-priority";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  const shadow = host.attachShadow({ mode: "closed" });
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <style>
      *{box-sizing:border-box} .shade{position:fixed;inset:0;background:rgba(12,27,23,.34);display:grid;place-items:center;padding:24px;font-family:system-ui,'Microsoft YaHei',sans-serif}
      .panel{width:min(440px,calc(100vw - 32px));background:#fbfdfb;border:1px solid #dce7e2;border-radius:22px;box-shadow:0 26px 80px rgba(5,35,29,.24);padding:22px;color:#14221f}
      .eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#128675;font-weight:800}.title{font-size:21px;font-weight:800;margin:6px 0}.reason{font-size:13px;line-height:1.6;color:#66736f;margin:0 0 16px}
      .list{display:grid;gap:8px}.row{display:grid;grid-template-columns:32px 1fr auto auto;align-items:center;gap:10px;padding:10px 11px;border:1px solid #dfe8e4;border-radius:13px;background:#fff}
      .rank{width:26px;height:26px;border-radius:8px;background:#e6f5f1;display:grid;place-items:center;color:#087b6e;font-weight:800}.name{font-weight:750}.meta{font-size:11px;color:#7c8985;margin-top:2px}.failed{color:#b66300}
      .move{display:flex;gap:4px}.move button{width:29px;height:29px;padding:0;border:1px solid #dbe5e1;background:#f7faf8;border-radius:8px;cursor:pointer;color:#3f514c}.move button:disabled{opacity:.35;cursor:default}
      .actions{display:flex;gap:10px;margin-top:18px}.actions button{height:42px;border-radius:12px;padding:0 16px;font-weight:750;cursor:pointer}.copy{border:1px solid #d8e3de;background:#fff;color:#43524e}.confirm{border:0;background:#0c927f;color:#fff;flex:1}
    </style>
    <div class="shade"><section class="panel" role="dialog" aria-modal="true" aria-label="调整 AI 站点优先级">
      <div class="eyebrow">Delivery fallback</div><div class="title">调整发送优先级</div>
      <p class="reason"><strong>${escapeHtml(message.failedProviderName)}</strong> 未提交本次提问：${escapeHtml(message.reason)}。调整顺序后会永久保存，并把当前提问发送给下一可用站点。</p>
      <div class="list"></div>
      <div class="actions"><button class="copy" type="button">仅复制提问</button><button class="confirm" type="button">保存顺序并继续</button></div>
    </section></div>`;
  shadow.appendChild(wrapper);
  document.documentElement.appendChild(host);

  const list = shadow.querySelector<HTMLElement>(".list");
  const render = () => {
    if (!list) return;
    list.replaceChildren();
    providers.forEach((provider, index) => {
      const row = document.createElement("div");
      row.className = "row";
      const state = provider.failed ? "本次失败" : !provider.enabled ? "未启用" : !provider.permissionGranted ? "未授权" : provider.open ? "已打开" : "未打开";
      row.innerHTML = `<div class="rank">${index + 1}</div><div><div class="name">${escapeHtml(provider.name)}</div><div class="meta ${provider.failed ? "failed" : ""}">${state}</div></div><div class="move"><button class="up" type="button" aria-label="上移">↑</button><button class="down" type="button" aria-label="下移">↓</button></div>`;
      const up = row.querySelector<HTMLButtonElement>(".up");
      const down = row.querySelector<HTMLButtonElement>(".down");
      if (up) {
        up.disabled = index === 0;
        up.addEventListener("click", () => { [providers[index - 1], providers[index]] = [providers[index]!, providers[index - 1]!]; render(); });
      }
      if (down) {
        down.disabled = index === providers.length - 1;
        down.addEventListener("click", () => { [providers[index], providers[index + 1]] = [providers[index + 1]!, providers[index]!]; render(); });
      }
      list.appendChild(row);
    });
  };
  render();

  shadow.querySelector(".confirm")?.addEventListener("click", () => {
    host.remove();
    void chrome.runtime.sendMessage({
      type: "BRIDGE_PRIORITY_CONFIRMED",
      dispatchId: message.dispatchId,
      orderedIds: providers.map((item) => item.id)
    });
  });
  shadow.querySelector(".copy")?.addEventListener("click", () => {
    host.remove();
    void chrome.runtime.sendMessage({ type: "BRIDGE_PRIORITY_CANCELLED", dispatchId: message.dispatchId });
  });
}

function isPriorityDialogMessage(value: Record<string, unknown>): value is Record<string, unknown> & PriorityDialogMessage {
  return typeof value.dispatchId === "string"
    && typeof value.failedProviderName === "string"
    && typeof value.reason === "string"
    && Array.isArray(value.providers);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
