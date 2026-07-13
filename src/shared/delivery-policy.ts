import type { DeliveryStatus } from "./types";

export function shouldOfferReroute(status: DeliveryStatus): boolean {
  return status === "not_ready" || status === "not_submitted";
}
