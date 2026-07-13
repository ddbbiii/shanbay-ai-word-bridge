import { describe, expect, it } from "vitest";

import { nextProvider, selectProviderTab } from "../src/shared/routing";
import { DEFAULT_SETTINGS } from "../src/shared/settings";
import type { ProviderRuntimeState } from "../src/shared/types";

describe("provider routing", () => {
  it("uses the first enabled, granted and open provider", () => {
    const states: ProviderRuntimeState[] = [
      { id: "gemini", permissionGranted: true, open: false },
      { id: "chatgpt", permissionGranted: true, open: true, tabId: 2 },
      { id: "doubao", permissionGranted: true, open: true, tabId: 3 },
      { id: "kimi", permissionGranted: false, open: false }
    ];
    expect(nextProvider(DEFAULT_SETTINGS, states)?.id).toBe("chatgpt");
    expect(nextProvider(DEFAULT_SETTINGS, states, ["chatgpt"])?.id).toBe("doubao");
  });

  it("prefers the exact configured conversation URL", () => {
    const tabs = [
      { id: 1, url: "https://chatgpt.com/c/recent", lastAccessed: 500 },
      { id: 2, url: "https://chatgpt.com/c/preferred/", lastAccessed: 100 }
    ];
    expect(selectProviderTab(tabs, "https://chatgpt.com/c/preferred")?.id).toBe(2);
  });

  it("falls back to the most recently accessed provider tab", () => {
    const tabs = [
      { id: 1, url: "https://www.kimi.com/chat/old", lastAccessed: 100 },
      { id: 2, url: "https://www.kimi.com/chat/new", lastAccessed: 900 }
    ];
    expect(selectProviderTab(tabs, "")?.id).toBe(2);
  });
});
