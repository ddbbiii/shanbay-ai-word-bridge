import type { ProviderId, SendMode } from "../shared/types";

export interface ProviderAdapter {
  id: ProviderId;
  editorSelectors: string[];
  sendButtonSelectors: string[];
  userMessageSelectors: string[];
}

export interface DeliverPromptInput {
  prompt: string;
  word: string;
  mode: SendMode;
}
