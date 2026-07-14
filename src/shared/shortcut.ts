import type { ShortcutSettings } from "./types";

export const DEFAULT_SHORTCUT: ShortcutSettings = {
  code: "Backquote",
  ctrl: false,
  alt: false,
  shift: false,
  meta: false
};

const PUNCTUATION_CODES = new Set([
  "Backquote",
  "Minus",
  "Equal",
  "BracketLeft",
  "BracketRight",
  "Backslash",
  "Semicolon",
  "Quote",
  "Comma",
  "Period",
  "Slash"
]);

const KEY_LABELS: Record<string, string> = {
  Backquote: "` / ·",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/"
};

interface ShortcutEventLike {
  code: string;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export function normalizeShortcut(raw: unknown): ShortcutSettings {
  if (!isRecord(raw) || !isSupportedShortcutCode(String(raw.code ?? ""))) {
    return { ...DEFAULT_SHORTCUT };
  }
  return {
    code: String(raw.code),
    ctrl: raw.ctrl === true,
    alt: raw.alt === true,
    shift: raw.shift === true,
    meta: raw.meta === true
  };
}

export function shortcutFromKeyboardEvent(event: ShortcutEventLike): ShortcutSettings | null {
  const code = resolveEventCode(event);
  if (!isSupportedShortcutCode(code)) return null;
  return {
    code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  };
}

export function matchesShortcut(event: ShortcutEventLike, shortcut: ShortcutSettings): boolean {
  const code = resolveEventCode(event);
  return code === shortcut.code
    && event.ctrlKey === shortcut.ctrl
    && event.altKey === shortcut.alt
    && event.shiftKey === shortcut.shift
    && event.metaKey === shortcut.meta;
}

export function shortcutLabels(shortcut: ShortcutSettings): string[] {
  const labels: string[] = [];
  if (shortcut.ctrl) labels.push("Ctrl");
  if (shortcut.alt) labels.push("Alt");
  if (shortcut.shift) labels.push("Shift");
  if (shortcut.meta) labels.push("Win");
  labels.push(KEY_LABELS[shortcut.code] ?? shortcut.code.replace(/^Key/, "").replace(/^Digit/, ""));
  return labels;
}

export function formatShortcut(shortcut: ShortcutSettings): string {
  return shortcutLabels(shortcut).join(" + ");
}

export function isSupportedShortcutCode(code: string): boolean {
  return /^Key[A-Z]$/.test(code)
    || /^Digit[0-9]$/.test(code)
    || /^F(?:[1-9]|1[0-2])$/.test(code)
    || /^Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal)$/.test(code)
    || PUNCTUATION_CODES.has(code);
}

function resolveEventCode(event: ShortcutEventLike): string {
  if (event.code === "Backquote") return "Backquote";
  if ((!event.code || event.code === "Unidentified") && ["`", "·", "Process"].includes(event.key)) {
    return "Backquote";
  }
  return event.code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
