import type { DeliveryResult } from "../shared/types";
import type { DeliverPromptInput, ProviderAdapter } from "./types";

const VERIFY_TIMEOUT_MS = 2800;
const VERIFY_INTERVAL_MS = 100;

export async function deliverPrompt(
  adapter: ProviderAdapter,
  input: DeliverPromptInput,
  root: Document = document
): Promise<DeliveryResult> {
  const editor = findVisibleElement(adapter.editorSelectors, root);
  if (!(editor instanceof HTMLElement)) {
    return result(adapter, "not_ready", "未找到可用输入框");
  }

  let interactionStarted = false;
  try {
    const messagesBefore = matchingElements(adapter.userMessageSelectors, root).length;
    const textBefore = readEditorText(editor);
    interactionStarted = true;
    writeEditorText(editor, input.prompt);
    await sleep(80);

    if (!editorContains(editor, input.prompt)) {
      return result(adapter, "not_submitted", "页面没有接受输入内容");
    }

    if (input.mode === "fill") {
      return { ...result(adapter, "filled"), ok: true };
    }

    const sendButton = findVisibleElement(adapter.sendButtonSelectors, root);
    if (sendButton instanceof HTMLButtonElement && isDisabled(sendButton)) {
      return result(adapter, "not_submitted", "发送按钮当前不可用");
    }

    if (sendButton instanceof HTMLElement) sendButton.click();
    else dispatchEnter(editor);

    const verification = await verifySubmission({
      adapter,
      editor,
      prompt: input.prompt,
      word: input.word,
      messagesBefore,
      root
    });
    if (verification) {
      return {
        ok: true,
        status: "sent",
        providerId: adapter.id,
        verifiedBy: verification
      };
    }

    if (editorContains(editor, input.prompt) || readEditorText(editor) === textBefore) {
      return result(adapter, "not_submitted", "已尝试发送，但内容仍留在输入框中");
    }
    return result(adapter, "submission_unknown", "页面发生变化，但无法确认消息是否已经提交");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知页面错误";
    return result(adapter, interactionStarted ? "submission_unknown" : "failed", reason);
  }
}

interface VerificationInput {
  adapter: ProviderAdapter;
  editor: HTMLElement;
  prompt: string;
  word: string;
  messagesBefore: number;
  root: Document;
}

async function verifySubmission(input: VerificationInput): Promise<"message" | "editor_cleared" | null> {
  const endAt = Date.now() + VERIFY_TIMEOUT_MS;
  const promptMarker = normalizeText(input.prompt).slice(0, 48);
  const wordMarker = normalizeText(input.word);
  while (Date.now() < endAt) {
    const currentMessages = matchingElements(input.adapter.userMessageSelectors, input.root);
    if (currentMessages.length > input.messagesBefore) {
      const latest = normalizeText(currentMessages.at(-1)?.textContent ?? "");
      if (!wordMarker || latest.includes(wordMarker) || latest.includes(promptMarker)) return "message";
    }
    if (!readEditorText(input.editor).trim()) return "editor_cleared";
    await sleep(VERIFY_INTERVAL_MS);
  }
  return null;
}

export function findVisibleElement(selectors: string[], root: Document = document): Element | null {
  for (const selector of selectors) {
    let elements: Element[] = [];
    try {
      elements = Array.from(root.querySelectorAll(selector));
    } catch {
      continue;
    }
    const visible = elements.find((element) => isVisible(element));
    if (visible) return visible;
  }
  return null;
}

export function writeEditorText(editor: HTMLElement, text: string): void {
  editor.focus();
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    setNativeValue(editor, text);
  } else {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const inserted = document.execCommand?.("insertText", false, text) ?? false;
    if (!inserted) editor.replaceChildren(document.createTextNode(text));
  }
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNativeValue(editor: HTMLTextAreaElement | HTMLInputElement, text: string): void {
  const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(editor, text);
  else editor.value = text;
}

function editorContains(editor: HTMLElement, text: string): boolean {
  const actual = normalizeText(readEditorText(editor));
  const expected = normalizeText(text);
  return actual === expected || actual.includes(expected.slice(0, Math.min(80, expected.length)));
}

function readEditorText(editor: HTMLElement): string {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) return editor.value;
  return editor.innerText || editor.textContent || "";
}

function matchingElements(selectors: string[], root: Document): Element[] {
  const seen = new Set<Element>();
  for (const selector of selectors) {
    try {
      for (const element of root.querySelectorAll(selector)) seen.add(element);
    } catch {
      // A stale site selector should not break the remaining verification paths.
    }
  }
  return [...seen];
}

function dispatchEnter(editor: HTMLElement): void {
  for (const type of ["keydown", "keypress", "keyup"]) {
    editor.dispatchEvent(new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      code: "Enter"
    }));
  }
}

function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width >= 8
    && rect.height >= 8
    && rect.bottom > 0
    && rect.right > 0
    && rect.top < window.innerHeight
    && rect.left < window.innerWidth
    && style.display !== "none"
    && style.visibility !== "hidden"
    && Number.parseFloat(style.opacity || "1") > 0;
}

function isDisabled(button: HTMLButtonElement): boolean {
  return button.disabled || button.getAttribute("aria-disabled") === "true";
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function result(adapter: ProviderAdapter, status: DeliveryResult["status"], reason?: string): DeliveryResult {
  return { ok: false, status, providerId: adapter.id, reason };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
