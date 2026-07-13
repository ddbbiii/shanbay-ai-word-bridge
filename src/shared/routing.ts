import { normalizeComparableUrl } from "./settings";
import type { AppSettings, ProviderId, ProviderRuntimeState, ProviderTabLike } from "./types";

export function orderedProviderIds(settings: AppSettings): ProviderId[] {
  return [...settings.providers]
    .sort((left, right) => left.priority - right.priority)
    .map((item) => item.id);
}

export function nextProvider(
  settings: AppSettings,
  states: ProviderRuntimeState[],
  excluded: ProviderId[] = []
): ProviderRuntimeState | null {
  const excludedSet = new Set(excluded);
  const stateMap = new Map(states.map((item) => [item.id, item]));
  for (const provider of [...settings.providers].sort((left, right) => left.priority - right.priority)) {
    const state = stateMap.get(provider.id);
    if (provider.enabled && state?.permissionGranted && state.open && !excludedSet.has(provider.id)) return state;
  }
  return null;
}

export function selectProviderTab(tabs: ProviderTabLike[], preferredUrl: string): ProviderTabLike | null {
  const usable = tabs.filter((tab) => typeof tab.id === "number" && typeof tab.url === "string");
  if (!usable.length) return null;
  const preferred = preferredUrl.trim();
  if (preferred) {
    const target = normalizeComparableUrl(preferred);
    const exact = usable.find((tab) => normalizeComparableUrl(tab.url ?? "") === target);
    if (exact) return exact;
  }
  return [...usable].sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0] ?? null;
}
