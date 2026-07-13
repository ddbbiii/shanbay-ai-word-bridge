import "./popup.css";

import { providerDefinition } from "../shared/providers";
import { loadLastOperation } from "../shared/storage";
import type { LastOperation, OperationStatus } from "../shared/types";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("弹窗挂载点不存在。");

app.innerHTML = `
  <div class="popup-shell">
    <header>
      <div class="logo">A<span>↗</span></div>
      <div><p>SHANBAY BRIDGE</p><h1>单词接力</h1></div>
      <button id="open-settings" class="icon-button" title="打开设置" aria-label="打开设置">⚙</button>
    </header>
    <main id="operation-card" class="operation-card is-empty">
      <div class="status-orbit"><span id="status-symbol">·</span></div>
      <p id="result-label" class="result-label">还没有发送记录</p>
      <h2 id="last-word">在扇贝页面触发一次快捷键</h2>
      <p id="result-detail" class="result-detail">优先发送到已授权、已打开的 AI 网页。</p>
      <div id="result-meta" class="result-meta"></div>
    </main>
    <div class="actions">
      <button id="copy-prompt" class="secondary-button" type="button" disabled>复制完整提问</button>
      <button id="open-settings-main" class="primary-button" type="button">配置站点</button>
    </div>
    <footer><kbd>Ctrl</kbd><span>+</span><kbd>Shift</kbd><span>+</span><kbd>Y</kbd><b>仅响应一次按键</b></footer>
  </div>
  <div id="toast" class="toast" role="status"></div>
`;

let lastOperation: LastOperation | null = null;
const openSettings = (): void => { void chrome.runtime.openOptionsPage(); window.close(); };
requiredElement<HTMLButtonElement>("#open-settings").addEventListener("click", openSettings);
requiredElement<HTMLButtonElement>("#open-settings-main").addEventListener("click", openSettings);
requiredElement<HTMLButtonElement>("#copy-prompt").addEventListener("click", () => { void copyLastPrompt(); });

void initialize();

async function initialize(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return;
  try {
    lastOperation = await loadLastOperation();
    if (lastOperation) render(lastOperation);
  } catch {
    showToast("无法读取最近状态", true);
  }
}

function render(operation: LastOperation): void {
  const presentation = statusPresentation(operation.status);
  const card = requiredElement<HTMLElement>("#operation-card");
  card.className = `operation-card ${presentation.className}`;
  requiredElement<HTMLElement>("#status-symbol").textContent = presentation.symbol;
  requiredElement<HTMLElement>("#result-label").textContent = presentation.label;
  requiredElement<HTMLElement>("#last-word").textContent = operation.word;
  requiredElement<HTMLElement>("#result-detail").textContent = operation.message;
  const meta = requiredElement<HTMLElement>("#result-meta");
  const provider = operation.providerId ? providerDefinition(operation.providerId).shortName : "剪贴板";
  const time = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(operation.occurredAt));
  meta.textContent = `${provider} · ${time}`;
  requiredElement<HTMLButtonElement>("#copy-prompt").disabled = !operation.prompt;
}

async function copyLastPrompt(): Promise<void> {
  if (!lastOperation?.prompt) return;
  try {
    await navigator.clipboard.writeText(lastOperation.prompt);
    showToast("完整提问已复制");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = lastOperation.prompt;
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    showToast(copied ? "完整提问已复制" : "复制失败，请重试", !copied);
  }
}

function statusPresentation(status: OperationStatus): { symbol: string; label: string; className: string } {
  switch (status) {
    case "sent": return { symbol: "✓", label: "已验证发送", className: "is-success" };
    case "filled": return { symbol: "↳", label: "已填入输入框", className: "is-success" };
    case "copied": return { symbol: "⧉", label: "已复制完整提问", className: "is-copied" };
    case "awaiting_priority": return { symbol: "!", label: "等待调整优先级", className: "is-warning" };
    case "submission_unknown": return { symbol: "?", label: "提交结果不确定", className: "is-warning" };
    case "permission_missing": return { symbol: "!", label: "缺少站点权限", className: "is-warning" };
    case "copy_failed": return { symbol: "×", label: "复制失败", className: "is-error" };
    default: return { symbol: "×", label: "本次未发送", className: "is-error" };
  }
}

let toastTimer = 0;
function showToast(message: string, error = false): void {
  const toast = requiredElement<HTMLElement>("#toast");
  toast.textContent = message;
  toast.className = `toast visible${error ? " error" : ""}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.className = "toast"; }, 1800);
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少页面元素：${selector}`);
  return element;
}
