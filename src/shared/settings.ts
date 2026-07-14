import { PROVIDERS, providerDefinition } from "./providers";
import { DEFAULT_SHORTCUT, normalizeShortcut } from "./shortcut";
import { PROVIDER_IDS, type AppSettings, type ProviderId, type ProviderSettings } from "./types";

export const DEFAULT_PROMPT_TEMPLATE = `请解释英文单词或短语：{word}

请用中文简洁说明：
1. 常见词性与英/美 IPA；
2. 是否适合拆分，只使用可靠的构词或词源线索；
3. 从词源或语义到核心意思的记忆链；
4. 1-3 个最常用含义；
5. 如果不适合拆分，提供一个谐音或场景记忆钩子；
6. 3-8 个高价值衍生词、相关词或易混词，并注明真同源还是仅相似；
7. 一个简短自然的例句。

不要为了方便记忆而捏造词根；如果词源不确定，请明确说明。`;

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  shortcut: { ...DEFAULT_SHORTCUT },
  providers: PROVIDERS.map((item, priority) => ({
    id: item.id,
    enabled: true,
    priority,
    mode: "send",
    preferredUrl: ""
  }))
};

export function buildPrompt(template: string, word: string): string {
  const normalizedWord = word.trim();
  if (!normalizedWord) throw new Error("单词不能为空。");
  if (!template.includes("{word}")) throw new Error("提示词模板必须包含 {word} 占位符。");
  return template.replaceAll("{word}", normalizedWord).trim();
}

export function normalizeSettings(raw: unknown): AppSettings {
  const candidate = isRecord(raw) ? raw : {};
  const template = typeof candidate.promptTemplate === "string" && candidate.promptTemplate.includes("{word}")
    ? candidate.promptTemplate
    : DEFAULT_PROMPT_TEMPLATE;
  const rawProviders = Array.isArray(candidate.providers) ? candidate.providers : [];
  const providers = PROVIDER_IDS.map((id, defaultPriority) => {
    const existing = rawProviders.find((item) => isRecord(item) && item.id === id);
    return normalizeProvider(existing, id, defaultPriority);
  });

  providers.sort((left, right) => left.priority - right.priority);
  providers.forEach((item, priority) => { item.priority = priority; });
  return { schemaVersion: 2, promptTemplate: template, providers, shortcut: normalizeShortcut(candidate.shortcut) };
}

function normalizeProvider(raw: unknown, id: ProviderId, defaultPriority: number): ProviderSettings {
  const item = isRecord(raw) ? raw : {};
  const preferredUrl = typeof item.preferredUrl === "string" && validatePreferredUrl(id, item.preferredUrl)
    ? item.preferredUrl.trim()
    : "";
  return {
    id,
    enabled: typeof item.enabled === "boolean" ? item.enabled : true,
    priority: typeof item.priority === "number" && Number.isFinite(item.priority) ? item.priority : defaultPriority,
    mode: item.mode === "fill" ? "fill" : "send",
    preferredUrl
  };
}

export function validatePreferredUrl(id: ProviderId, value: string): boolean {
  const input = value.trim();
  if (!input) return true;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && providerDefinition(id).hostnames.includes(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeComparableUrl(value: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.origin}${pathname}`;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

export function applyProviderOrder(settings: AppSettings, orderedIds: ProviderId[]): AppSettings {
  const unique = [...new Set(orderedIds)].filter((id): id is ProviderId => PROVIDER_IDS.includes(id));
  const complete = [...unique, ...PROVIDER_IDS.filter((id) => !unique.includes(id))];
  const rank = new Map(complete.map((id, index) => [id, index]));
  return {
    ...settings,
    providers: settings.providers
      .map((item) => ({ ...item, priority: rank.get(item.id) ?? item.priority }))
      .sort((left, right) => left.priority - right.priority)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
