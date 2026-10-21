import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_OPTION,
  DELIVERY_OPTION_LABEL_FR,
  DEPOSIT_STATUS,
  DEPOSIT_STATUS_LABEL_FR,
  DOCUMENT_TYPE,
  DOCUMENT_TYPE_LABEL_FR,
  GUEST_SESSION_MS,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
  SLOT_HOLDING_STATUSES,
  VERIFICATION_STATUS,
  VERIFICATION_STATUS_LABEL_FR,
  deliveryTrips,
  holdsSlot,
} from "@/lib/constants";

describe("which bookings hold a trailer", () => {
  // The owner's rule (2026-10-20): an unfinished booking never blocks anyone, the first client to finish
  // gets the trailer.
  it("only confirmed, started and finished bookings do", () => {
    assert.equal(holdsSlot("confirmed"), true);
    assert.equal(holdsSlot("in_progress"), true);
    assert.equal(holdsSlot("completed"), true);
  });

  it("an unfinished or cancelled booking does not", () => {
    assert.equal(holdsSlot("pending"), false);
    assert.equal(holdsSlot("cancelled"), false);
    assert.equal(holdsSlot("anything else"), false);
  });

  it("every holding status is a real reservation status", () => {
    for (const status of SLOT_HOLDING_STATUSES) assert.ok((RESERVATION_STATUS as readonly string[]).includes(status));
  });
});

describe("transport trips", () => {
  it("counts two trips for a delivery and pickup, one for a single leg, none at the depot", () => {
    assert.equal(deliveryTrips("pickup"), 0);
    assert.equal(deliveryTrips("delivery"), 2);
    assert.equal(deliveryTrips("delivery_only"), 1);
    assert.equal(deliveryTrips("return_only"), 1);
  });
});

describe("labels", () => {
  it("every delivery option, deposit status, document type and verification status has a French label", () => {
    for (const option of DELIVERY_OPTION) assert.ok(DELIVERY_OPTION_LABEL_FR[option], option);
    for (const status of DEPOSIT_STATUS) assert.ok(DEPOSIT_STATUS_LABEL_FR[status], status);
    for (const type of DOCUMENT_TYPE) assert.ok(DOCUMENT_TYPE_LABEL_FR[type], type);
    for (const status of VERIFICATION_STATUS) assert.ok(VERIFICATION_STATUS_LABEL_FR[status], status);
  });

  it("payment statuses are unique", () => {
    assert.equal(new Set(PAYMENT_STATUS).size, PAYMENT_STATUS.length);
  });
});

describe("guest session", () => {
  it("lasts six hours", () => {
    assert.equal(GUEST_SESSION_MS, 6 * 60 * 60 * 1000);
  });
});
