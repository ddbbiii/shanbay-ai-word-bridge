import type { ProviderId } from "../shared/types";
import { chatgptAdapter } from "./chatgpt";
import { doubaoAdapter } from "./doubao";
import { geminiAdapter } from "./gemini";
import { kimiAdapter } from "./kimi";
import type { ProviderAdapter } from "./types";

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  gemini: geminiAdapter,
  chatgpt: chatgptAdapter,
  doubao: doubaoAdapter,
  kimi: kimiAdapter
};

export function providerAdapter(id: ProviderId): ProviderAdapter {
  return ADAPTERS[id];
}
