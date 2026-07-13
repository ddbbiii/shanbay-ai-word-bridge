import type { ProviderAdapter } from "./types";

export const geminiAdapter: ProviderAdapter = {
  id: "gemini",
  editorSelectors: [
    "rich-textarea .ql-editor[contenteditable='true']",
    "[contenteditable='true'][role='textbox'][aria-label*='prompt' i]",
    "[contenteditable='true'][role='textbox'][aria-label*='输入' i]",
    "div[contenteditable='true'][role='textbox']"
  ],
  sendButtonSelectors: [
    "button[aria-label*='Send message' i]",
    "button[aria-label*='Send' i]",
    "button[aria-label*='发送' i]",
    "button.send-button"
  ],
  userMessageSelectors: [
    "user-query",
    "[data-test-id='user-query']",
    "[class*='user-query']"
  ]
};
