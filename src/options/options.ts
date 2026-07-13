import "./options.css";

import { providerDefinition } from "../shared/providers";
import { DEFAULT_PROMPT_TEMPLATE, normalizeSettings, validatePreferredUrl } from "../shared/settings";
import type { AppSettings, ProviderId, ProviderRuntimeState, ProviderSettings } from "../shared/types";

interface SettingsResponse {
  settings?: AppSettings;
  states?: ProviderRuntimeState[];
  ok?: boolean;
  reason?: string;
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("设置页挂载点不存在。");

let settings = normalizeSettings(null);
let states: ProviderRuntimeState[] = [];
let draggedId: ProviderId | null = null;

app.innerHTML = `
  <div class="page-shell">
    <header class="hero">
      <div class="brand-mark" aria-hidden="true">A<span>↗</span></div>
      <div>
        <p class="eyebrow">SHANBAY AI WORD BRIDGE</p>
        <h1>把当前单词送到你信任的 AI</h1>
        <p class="lede">只访问你主动授权的站点。优先使用已打开的网页；无法安全确认提交时，绝不自动改投。</p>
      </div>
      <div class="privacy-chip"><span></span> 配置仅保存在本机</div>
    </header>

    <section class="panel provider-panel" aria-labelledby="providers-title">
      <div class="section-heading">
        <div><p class="section-index">01</p><h2 id="providers-title">站点与优先级</h2></div>
        <p>拖拽卡片或使用箭头调整顺序。调度时只选择已启用、已授权且已经打开的站点。</p>
      </div>
      <div id="provider-list" class="provider-list"></div>
    </section>

    <section class="panel template-panel" aria-labelledby="template-title">
      <div class="section-heading">
        <div><p class="section-index">02</p><h2 id="template-title">单词解释模板</h2></div>
        <button id="reset-template" class="text-button" type="button">恢复默认</button>
      </div>
      <label class="field-label" for="prompt-template">每次发送都会用当前单词替换 <code>{word}</code></label>
      <textarea id="prompt-template" rows="15" spellcheck="false"></textarea>
      <p id="template-hint" class="field-hint">模板必须保留 <code>{word}</code> 占位符。</p>
    </section>

    <footer class="save-bar">
      <div><strong>快捷键</strong><span>扇贝页面按 <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Y</kbd>，也可选中文本后触发。</span></div>
      <button id="save-settings" class="primary-button" type="button">保存全部设置</button>
    </footer>
  </div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

const providerList = requiredElement<HTMLElement>("#provider-list");
const templateInput = requiredElement<HTMLTextAreaElement>("#prompt-template");
const templateHint = requiredElement<HTMLElement>("#template-hint");
const saveButton = requiredElement<HTMLButtonElement>("#save-settings");

requiredElement<HTMLButtonElement>("#reset-template").addEventListener("click", () => {
  templateInput.value = DEFAULT_PROMPT_TEMPLATE;
  validateTemplate();
  showToast("已恢复默认模板，保存后生效");
});
templateInput.addEventListener("input", validateTemplate);
saveButton.addEventListener("click", () => { void saveAll(); });

void initialize();

async function initialize(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    settings = normalizeSettings(null);
    states = settings.providers.map((item) => ({ id: item.id, permissionGranted: false, open: false }));
    templateInput.value = settings.promptTemplate;
    renderProviders();
    validateTemplate();
    return;
  }
  try {
    const response = await sendMessage<SettingsResponse>({ type: "BRIDGE_GET_SETTINGS" });
    settings = normalizeSettings(response.settings);
    const stateResponse = await sendMessage<SettingsResponse>({ type: "BRIDGE_GET_PROVIDER_STATES" });
    states = stateResponse.states ?? [];
    templateInput.value = settings.promptTemplate;
    renderProviders();
    validateTemplate();
  } catch (error) {
    showToast(errorMessage(error, "读取设置失败"), true);
  }
}

function renderProviders(): void {
  providerList.replaceChildren();
  const ordered = [...settings.providers].sort((left, right) => left.priority - right.priority);
  ordered.forEach((provider, index) => providerList.appendChild(createProviderCard(provider, index, ordered.length)));
}

function createProviderCard(provider: ProviderSettings, index: number, total: number): HTMLElement {
  const definition = providerDefinition(provider.id);
  const runtime = states.find((item) => item.id === provider.id);
  const card = document.createElement("article");
  card.className = `provider-card${provider.enabled ? "" : " is-disabled"}`;
  card.draggable = true;
  card.dataset.providerId = provider.id;
  card.innerHTML = `
    <div class="drag-handle" title="拖拽排序" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="provider-badge" style="--provider-color:${definition.color}">${definition.shortName.slice(0, 1)}</div>
    <div class="provider-main">
      <div class="provider-title-row">
        <div><span class="rank">${String(index + 1).padStart(2, "0")}</span><h3>${definition.name}</h3></div>
        <label class="switch"><input class="enabled-toggle" type="checkbox" ${provider.enabled ? "checked" : ""}><span></span><b>${provider.enabled ? "已启用" : "已停用"}</b></label>
      </div>
      <div class="provider-controls">
        <label>发送方式<select class="mode-select"><option value="send" ${provider.mode === "send" ? "selected" : ""}>自动发送</option><option value="fill" ${provider.mode === "fill" ? "selected" : ""}>仅填入</option></select></label>
        <label class="url-field">目标会话（可选）<input class="url-input" type="url" placeholder="${definition.origins[0]?.replace("*", "") ?? "https://"}" autocomplete="off"></label>
      </div>
      <div class="provider-footer">
        <div class="site-state">
          <span class="status-dot ${runtime?.permissionGranted ? "granted" : ""}"></span>
          ${runtime?.permissionGranted ? "已授权" : "未授权"}
          <span class="divider">·</span>
          ${runtime?.open ? "网页已打开" : "网页未打开"}
        </div>
        <div class="provider-actions">
          <button class="move-button move-up" type="button" aria-label="上移" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="move-button move-down" type="button" aria-label="下移" ${index === total - 1 ? "disabled" : ""}>↓</button>
          <button class="permission-button" type="button">${runtime?.permissionGranted ? "撤销访问权" : "授权访问"}</button>
        </div>
      </div>
      <p class="url-error" aria-live="polite"></p>
    </div>
  `;

  const urlInput = requiredChild<HTMLInputElement>(card, ".url-input");
  urlInput.value = provider.preferredUrl;
  requiredChild<HTMLInputElement>(card, ".enabled-toggle").addEventListener("change", (event) => {
    provider.enabled = (event.currentTarget as HTMLInputElement).checked;
    renderProviders();
  });
  requiredChild<HTMLSelectElement>(card, ".mode-select").addEventListener("change", (event) => {
    provider.mode = (event.currentTarget as HTMLSelectElement).value === "fill" ? "fill" : "send";
  });
  urlInput.addEventListener("input", () => {
    provider.preferredUrl = urlInput.value.trim();
    validateUrl(card, provider);
  });
  requiredChild<HTMLButtonElement>(card, ".move-up").addEventListener("click", () => moveProvider(provider.id, -1));
  requiredChild<HTMLButtonElement>(card, ".move-down").addEventListener("click", () => moveProvider(provider.id, 1));
  requiredChild<HTMLButtonElement>(card, ".permission-button").addEventListener("click", () => {
    void togglePermission(provider.id, Boolean(runtime?.permissionGranted));
  });

  card.addEventListener("dragstart", () => { draggedId = provider.id; card.classList.add("is-dragging"); });
  card.addEventListener("dragend", () => { draggedId = null; card.classList.remove("is-dragging"); });
  card.addEventListener("dragover", (event) => { event.preventDefault(); card.classList.add("is-drag-over"); });
  card.addEventListener("dragleave", () => card.classList.remove("is-drag-over"));
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("is-drag-over");
    if (draggedId && draggedId !== provider.id) reorderProvider(draggedId, provider.id);
  });
  return card;
}

function moveProvider(id: ProviderId, delta: -1 | 1): void {
  const ordered = [...settings.providers].sort((left, right) => left.priority - right.priority);
  const index = ordered.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ordered.length) return;
  [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
  applyOrder(ordered.map((item) => item.id));
}

function reorderProvider(sourceId: ProviderId, targetId: ProviderId): void {
  const ordered = [...settings.providers].sort((left, right) => left.priority - right.priority);
  const source = ordered.findIndex((item) => item.id === sourceId);
  const target = ordered.findIndex((item) => item.id === targetId);
  if (source < 0 || target < 0) return;
  const [moved] = ordered.splice(source, 1);
  if (moved) ordered.splice(target, 0, moved);
  applyOrder(ordered.map((item) => item.id));
}

function applyOrder(ids: ProviderId[]): void {
  const rank = new Map(ids.map((id, index) => [id, index]));
  settings.providers.forEach((item) => { item.priority = rank.get(item.id) ?? item.priority; });
  renderProviders();
}

async function togglePermission(id: ProviderId, granted: boolean): Promise<void> {
  const definition = providerDefinition(id);
  try {
    const changed = granted
      ? await chrome.permissions.remove({ origins: definition.origins })
      : await chrome.permissions.request({ origins: definition.origins });
    if (!changed) {
      showToast(granted ? "访问权未被撤销" : "未获得站点访问权", true);
      return;
    }
    await sendMessage({ type: "BRIDGE_SETTINGS_UPDATED" });
    const response = await sendMessage<SettingsResponse>({ type: "BRIDGE_GET_PROVIDER_STATES" });
    states = response.states ?? [];
    renderProviders();
    showToast(granted ? `已撤销 ${definition.shortName} 访问权` : `已授权 ${definition.shortName}`);
  } catch (error) {
    showToast(errorMessage(error, "权限操作失败"), true);
  }
}

async function saveAll(): Promise<void> {
  settings.promptTemplate = templateInput.value.trim();
  if (!validateTemplate()) {
    templateInput.focus();
    return;
  }
  const invalidCard = [...providerList.querySelectorAll<HTMLElement>(".provider-card")]
    .find((card) => {
      const id = card.dataset.providerId as ProviderId | undefined;
      const provider = settings.providers.find((item) => item.id === id);
      return provider ? !validateUrl(card, provider) : false;
    });
  if (invalidCard) {
    invalidCard.querySelector<HTMLInputElement>(".url-input")?.focus();
    showToast("请修正目标会话 URL", true);
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "正在保存…";
  try {
    settings = normalizeSettings(settings);
    const response = await sendMessage<SettingsResponse>({ type: "BRIDGE_SAVE_SETTINGS", settings });
    settings = normalizeSettings(response.settings);
    states = response.states ?? states;
    renderProviders();
    showToast("设置已保存");
  } catch (error) {
    showToast(errorMessage(error, "保存失败"), true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "保存全部设置";
  }
}

function validateTemplate(): boolean {
  const valid = templateInput.value.includes("{word}");
  templateInput.classList.toggle("is-invalid", !valid);
  templateHint.classList.toggle("error", !valid);
  templateHint.innerHTML = valid
    ? "模板必须保留 <code>{word}</code> 占位符。"
    : "缺少 <code>{word}</code>，当前模板无法保存。";
  return valid;
}

function validateUrl(card: HTMLElement, provider: ProviderSettings): boolean {
  const valid = validatePreferredUrl(provider.id, provider.preferredUrl);
  const input = requiredChild<HTMLInputElement>(card, ".url-input");
  const error = requiredChild<HTMLElement>(card, ".url-error");
  input.classList.toggle("is-invalid", !valid);
  error.textContent = valid ? "" : `请输入 ${providerDefinition(provider.id).shortName} 的 HTTPS 会话地址。`;
  return valid;
}

let toastTimer = 0;
function showToast(message: string, error = false): void {
  const toast = requiredElement<HTMLElement>("#toast");
  toast.textContent = message;
  toast.className = `toast is-visible${error ? " is-error" : ""}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.className = "toast"; }, 2800);
}

function sendMessage<T = unknown>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少页面元素：${selector}`);
  return element;
}

function requiredChild<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`缺少卡片元素：${selector}`);
  return element;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
