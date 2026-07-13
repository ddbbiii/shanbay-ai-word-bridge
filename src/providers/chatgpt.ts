import type { ProviderAdapter } from "./types";

export const chatgptAdapter: ProviderAdapter = {
  id: "chatgpt",
  editorSelectors: [
    "#prompt-textarea",
    "textarea[data-id='root']",
    "[contenteditable='true'][data-virtualkeyboard='true']",
    "[contenteditable='true'][role='textbox']"
  ],
  sendButtonSelectors: [
    "button[data-testid='send-button']",
    "button[aria-label*='Send prompt' i]",
    "button[aria-label*='Send message' i]",
    "button[aria-label*='发送' i]"
  ],
  userMessageSelectors: [
    "[data-message-author-role='user']",
    "article [data-message-author-role='user']"
  ]
};
