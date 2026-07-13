import { describe, expect, it } from "vitest";

import { isRecentDuplicate } from "../src/shared/dedupe";
import { shouldOfferReroute } from "../src/shared/delivery-policy";
import type { DeliveryStatus } from "../src/shared/types";

describe("delivery safety", () => {
  it("deduplicates the same word inside the configured interval", () => {
    expect(isRecentDuplicate({ word: "derive", at: 1_000 }, "derive", 1_500)).toBe(true);
    expect(isRecentDuplicate({ word: "derive", at: 1_000 }, "derive", 2_000)).toBe(false);
    expect(isRecentDuplicate({ word: "derive", at: 1_000 }, "derivative", 1_200)).toBe(false);
  });

  it("only reroutes after a confirmed non-submission", () => {
    const reroutable: DeliveryStatus[] = ["not_ready", "not_submitted"];
    const unsafe: DeliveryStatus[] = ["sent", "filled", "submission_unknown", "permission_missing", "failed"];
    expect(reroutable.every(shouldOfferReroute)).toBe(true);
    expect(unsafe.some(shouldOfferReroute)).toBe(false);
  });
});
