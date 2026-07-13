import type { ProviderAdapter } from "./types";

export const doubaoAdapter: ProviderAdapter = {
  id: "doubao",
  editorSelectors: [
    "textarea[placeholder*='发送' i]",
    "textarea[placeholder*='输入' i]",
    "[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']"
  ],
  sendButtonSelectors: [
    "button[aria-label*='发送' i]",
    "button[data-testid*='send' i]",
    "[role='button'][aria-label*='发送' i]"
  ],
  userMessageSelectors: [
    "[data-testid*='user-message' i]",
    "[data-message-role='user']",
    "[class*='message'] [class*='user']"
  ]
};
