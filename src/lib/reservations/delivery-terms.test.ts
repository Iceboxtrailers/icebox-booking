import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NO_DELIVERY, resolveDeliveryTerms } from "@/lib/reservations/delivery-terms";

const atDepot = { ...NO_DELIVERY, totalAmount: 195000 };
const delivered = {
  deliveryOption: "delivery" as const,
  usageLocation: "777 rue Villeray, Montréal",
  deliveryFeeCents: 49000,
  deliveryDistanceKm: 250,
  totalAmount: 195000,
};

function terms(result: ReturnType<typeof resolveDeliveryTerms>) {
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result;
}

describe("transport set from the console", () => {
  it("adds a delivery, its address and its fee to a booking picked up at the depot", () => {
    const result = terms(
      resolveDeliveryTerms(atDepot, { deliveryOption: "delivery", usageLocation: "  777 rue Villeray, Montréal ", deliveryFeeCents: 49000 }),
    );
    assert.deepEqual(result.terms, {
      deliveryOption: "delivery",
      usageLocation: "777 rue Villeray, Montréal",
      deliveryFeeCents: 49000,
      deliveryDistanceKm: null,
    });
    assert.equal(result.changed, true);
  });

  it("asks for an address whenever the trailer travels", () => {
    for (const deliveryOption of ["delivery", "delivery_only", "return_only"] as const) {
      for (const usageLocation of [undefined, "", "   "]) {
        const result = resolveDeliveryTerms(atDepot, { deliveryOption, usageLocation, deliveryFeeCents: 1000 });
        assert.deepEqual(result, { ok: false, error: "Adresse de livraison requise" }, `${deliveryOption} / ${JSON.stringify(usageLocation)}`);
      }
    }
  });

  it("takes an address for a pickup at the depot too, but never a fee", () => {
    const result = terms(resolveDeliveryTerms(atDepot, { deliveryOption: "pickup", usageLocation: "Marché Jean-Talon", deliveryFeeCents: 5000 }));
    assert.equal(result.terms.usageLocation, "Marché Jean-Talon");
    assert.equal(result.terms.deliveryFeeCents, 0);
  });

  it("lets the fee be as large as the total, not larger", () => {
    assert.ok(resolveDeliveryTerms(atDepot, { deliveryOption: "delivery", usageLocation: "Montréal", deliveryFeeCents: 195000 }).ok);
    assert.deepEqual(resolveDeliveryTerms(atDepot, { deliveryOption: "delivery", usageLocation: "Montréal", deliveryFeeCents: 195001 }), {
      ok: false,
      error: "Les frais de transport dépassent le montant total",
    });
  });

  it("refuses a new price that no longer covers the fee already set", () => {
    assert.deepEqual(resolveDeliveryTerms(delivered, { totalAmount: 40000 }), {
      ok: false,
      error: "Les frais de transport dépassent le montant total",
    });
    assert.ok(resolveDeliveryTerms(delivered, { totalAmount: 60000 }).ok);
  });

  it("leaves alone what the request does not mention", () => {
    const result = terms(resolveDeliveryTerms(delivered, { totalAmount: 200000 }));
    assert.deepEqual(result.terms, {
      deliveryOption: "delivery",
      usageLocation: "777 rue Villeray, Montréal",
      deliveryFeeCents: 49000,
      deliveryDistanceKm: 250,
    });
    assert.equal(result.changed, false);
  });

  it("drops the fee and keeps nothing of the distance when the trailer is picked up at the depot again", () => {
    const result = terms(resolveDeliveryTerms(delivered, { deliveryOption: "pickup" }));
    assert.equal(result.terms.deliveryFeeCents, 0);
    assert.equal(result.terms.deliveryDistanceKm, null);
    assert.equal(result.changed, true);
  });

  it("forgets a distance worked out for another address or price, and keeps it when nothing moved", () => {
    assert.equal(terms(resolveDeliveryTerms(delivered, { usageLocation: "1 rue Sainte-Catherine, Montréal" })).terms.deliveryDistanceKm, null);
    assert.equal(terms(resolveDeliveryTerms(delivered, { deliveryFeeCents: 50000 })).terms.deliveryDistanceKm, null);
    assert.equal(terms(resolveDeliveryTerms(delivered, { deliveryOption: "delivery_only" })).terms.deliveryDistanceKm, null);
    const same = terms(resolveDeliveryTerms(delivered, { usageLocation: "777 rue Villeray, Montréal", deliveryFeeCents: 49000, deliveryOption: "delivery" }));
    assert.equal(same.terms.deliveryDistanceKm, 250);
    assert.equal(same.changed, false);
  });

  it("empties the address when asked, for a pickup at the depot", () => {
    const result = terms(resolveDeliveryTerms({ ...atDepot, usageLocation: "Marché Jean-Talon" }, { usageLocation: "" }));
    assert.equal(result.terms.usageLocation, null);
    assert.equal(result.changed, true);
  });
});
