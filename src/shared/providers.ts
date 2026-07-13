import type { ProviderDefinition, ProviderId } from "./types";

export const PROVIDERS: readonly ProviderDefinition[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    shortName: "Gemini",
    origins: ["https://gemini.google.com/*"],
    matches: ["https://gemini.google.com/*"],
    hostnames: ["gemini.google.com"],
    color: "#2471e8"
  },
  {
    id: "chatgpt",
    name: "OpenAI ChatGPT",
    shortName: "ChatGPT",
    origins: ["https://chatgpt.com/*"],
    matches: ["https://chatgpt.com/*"],
    hostnames: ["chatgpt.com"],
    color: "#111b18"
  },
  {
    id: "doubao",
    name: "豆包",
    shortName: "豆包",
    origins: ["https://www.doubao.com/*"],
    matches: ["https://www.doubao.com/*"],
    hostnames: ["www.doubao.com"],
    color: "#4e65ff"
  },
  {
    id: "kimi",
    name: "Kimi",
    shortName: "Kimi",
    origins: ["https://www.kimi.com/*"],
    matches: ["https://www.kimi.com/*"],
    hostnames: ["www.kimi.com"],
    color: "#111111"
  }
] as const;

export function providerDefinition(id: ProviderId): ProviderDefinition {
  const definition = PROVIDERS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown provider: ${id}`);
  return definition;
}

export function providerIdForHostname(hostname: string): ProviderId | null {
  return PROVIDERS.find((item) => item.hostnames.includes(hostname))?.id ?? null;
}
