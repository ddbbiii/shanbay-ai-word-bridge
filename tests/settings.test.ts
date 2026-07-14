import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  applyProviderOrder,
  buildPrompt,
  normalizeSettings,
  validatePreferredUrl
} from "../src/shared/settings";
import {
  DEFAULT_SHORTCUT,
  formatShortcut,
  matchesShortcut,
  shortcutFromKeyboardEvent
} from "../src/shared/shortcut";

describe("settings", () => {
  it("expands the word placeholder exactly where configured", () => {
    expect(buildPrompt("解释：{word}", "  resilient ")).toBe("解释：resilient");
  });

  it("rejects a template without the word placeholder", () => {
    expect(() => buildPrompt("解释这个单词", "resilient")).toThrow("{word}");
  });

  it("normalizes malformed settings and keeps all four providers", () => {
    const normalized = normalizeSettings({ providers: [{ id: "chatgpt", priority: -1, mode: "fill" }] });
    expect(normalized.providers).toHaveLength(4);
    expect(normalized.providers[0]).toMatchObject({ id: "chatgpt", priority: 0, mode: "fill" });
    expect(normalized.promptTemplate).toContain("{word}");
    expect(normalized.shortcut).toEqual(DEFAULT_SHORTCUT);
  });

  it("matches the default backquote key across Chinese keyboard labels", () => {
    expect(matchesShortcut({
      code: "Unidentified",
      key: "·",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false
    }, DEFAULT_SHORTCUT)).toBe(true);
  });

  it("matches a literal middle dot even when an IME reports a different physical code", () => {
    expect(matchesShortcut({
      code: "Digit2",
      key: "·",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false
    }, DEFAULT_SHORTCUT)).toBe(true);
  });

  it("captures and formats a custom key combination", () => {
    const shortcut = shortcutFromKeyboardEvent({
      code: "KeyK",
      key: "K",
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false
    });
    expect(shortcut).not.toBeNull();
    expect(formatShortcut(shortcut!)).toBe("Ctrl + Shift + K");
    expect(normalizeSettings({ shortcut }).shortcut).toEqual(shortcut);
  });

  it("does not confuse an IME Process key with backquote when a physical code exists", () => {
    expect(shortcutFromKeyboardEvent({
      code: "KeyK",
      key: "Process",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false
    })?.code).toBe("KeyK");
  });

  it("only accepts a preferred URL from the matching provider", () => {
    expect(validatePreferredUrl("chatgpt", "https://chatgpt.com/c/abc")).toBe(true);
    expect(validatePreferredUrl("chatgpt", "https://gemini.google.com/app/abc")).toBe(false);
    expect(validatePreferredUrl("chatgpt", "javascript:alert(1)")).toBe(false);
  });

  it("persists a complete provider order", () => {
    const reordered = applyProviderOrder(DEFAULT_SETTINGS, ["kimi", "doubao"]);
    expect(reordered.providers.map((item) => item.id)).toEqual(["kimi", "doubao", "gemini", "chatgpt"]);
  });
});
