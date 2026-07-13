import type { ProviderAdapter } from "./types";

export const kimiAdapter: ProviderAdapter = {
  id: "kimi",
  editorSelectors: [
    "textarea[placeholder*='Ask' i]",
    "textarea[placeholder*='输入' i]",
    "[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']"
  ],
  sendButtonSelectors: [
    "button[aria-label*='发送' i]",
    "button[aria-label*='Send' i]",
    "button[data-testid*='send' i]"
  ],
  userMessageSelectors: [
    "[data-role='user']",
    "[data-message-role='user']",
    "[class*='user-content']"
  ]
};
