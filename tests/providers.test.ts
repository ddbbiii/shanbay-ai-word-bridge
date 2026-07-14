import { describe, expect, it } from "vitest";

import { chatgptAdapter } from "../src/providers/chatgpt";
import { deliverPrompt } from "../src/providers/deliver";
import { doubaoAdapter } from "../src/providers/doubao";
import { geminiAdapter } from "../src/providers/gemini";
import { kimiAdapter } from "../src/providers/kimi";
import type { ProviderAdapter } from "../src/providers/types";

interface Fixture {
  adapter: ProviderAdapter;
  markup: string;
  editorSelector: string;
  buttonSelector: string;
  messageMarkup: string;
}

const fixtures: Fixture[] = [
  {
    adapter: geminiAdapter,
    markup: `<rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea><button aria-label="Send message">Send</button>`,
    editorSelector: ".ql-editor",
    buttonSelector: "button",
    messageMarkup: `<user-query>bridgeword</user-query>`
  },
  {
    adapter: chatgptAdapter,
    markup: `<textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button>`,
    editorSelector: "#prompt-textarea",
    buttonSelector: "button",
    messageMarkup: `<article data-message-author-role="user">bridgeword</article>`
  },
  {
    adapter: doubaoAdapter,
    markup: `<div class="semi-input-textarea-wrapper"><textarea class="semi-input-textarea semi-input-textarea-autosize" placeholder="发消息..."></textarea></div><button id="flow-end-msg-send" data-disabled="false" aria-label=""></button>`,
    editorSelector: "textarea",
    buttonSelector: "button",
    messageMarkup: `<div data-message-role="user">bridgeword</div>`
  },
  {
    adapter: kimiAdapter,
    markup: `<textarea placeholder="Ask anything"></textarea><button aria-label="Send">Send</button>`,
    editorSelector: "textarea",
    buttonSelector: "button",
    messageMarkup: `<div data-role="user">bridgeword</div>`
  }
];

describe.each(fixtures)("$adapter.id adapter", ({ adapter, markup, editorSelector, buttonSelector, messageMarkup }) => {
  it("locates the editor, writes, sends and verifies the user message", async () => {
    document.body.innerHTML = markup;
    const editor = document.querySelector<HTMLElement>(editorSelector);
    const button = document.querySelector<HTMLButtonElement>(buttonSelector);
    expect(editor).not.toBeNull();
    expect(button).not.toBeNull();
    button?.addEventListener("click", () => {
      editor?.replaceChildren();
      document.body.insertAdjacentHTML("beforeend", messageMarkup);
    });
    const result = await deliverPrompt(adapter, { prompt: "请解释 bridgeword", word: "bridgeword", mode: "send" });
    expect(result).toMatchObject({ ok: true, status: "sent", providerId: adapter.id });
  });

  it("supports fill-only mode without clicking send", async () => {
    document.body.innerHTML = markup;
    let clicks = 0;
    document.querySelector<HTMLButtonElement>(buttonSelector)?.addEventListener("click", () => { clicks += 1; });
    const result = await deliverPrompt(adapter, { prompt: "请解释 bridgeword", word: "bridgeword", mode: "fill" });
    expect(result).toMatchObject({ ok: true, status: "filled" });
    expect(clicks).toBe(0);
  });
});
