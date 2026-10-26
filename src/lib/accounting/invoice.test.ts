import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInvoicePayload } from "@/lib/accounting/invoice";
import type { InvoiceIds, InvoiceSource } from "@/lib/accounting/invoice";

const ids: InvoiceIds = { customerId: "69", rentalItemId: "28", transportItemId: "29", taxCodeId: "5" };

const booking: InvoiceSource = {
  reservationId: "res_1",
  trailerSize: "6x12",
  pickupDate: "2026-11-11",
  returnDate: "2026-12-26",
  nights: 45,
  totalCents: 195000,
  deliveryFeeCents: 0,
  deliveryOption: "pickup",
  deliveryDistanceKm: null,
  clientEmail: "riad@example.com",
};

type Line = { Amount: number; Description: string; SalesItemLineDetail: { ItemRef: { value: string }; UnitPrice: number; Qty: number; TaxCodeRef: { value: string } } };
const linesOf = (src: Partial<InvoiceSource> = {}) => buildInvoicePayload({ ...booking, ...src }, ids, "2026-10-24").Line as Line[];

describe("invoice sent to QuickBooks", () => {
  it("is one rental line for a booking picked up at the depot", () => {
    const lines = linesOf();
    assert.equal(lines.length, 1);
    assert.equal(lines[0].Amount, 1950);
    assert.equal(lines[0].SalesItemLineDetail.ItemRef.value, "28");
    assert.equal(lines[0].Description, "Location de remorque réfrigérée 6x12 du 2026-11-11 au 2026-12-26 (45 jours)");
  });

  it("adds a transport line with the transport item, and the rental is what is left of the total", () => {
    const lines = linesOf({ deliveryOption: "delivery", deliveryFeeCents: 49000 });
    assert.equal(lines.length, 2);
    assert.equal(lines[0].Amount, 1460);
    assert.equal(lines[0].SalesItemLineDetail.ItemRef.value, "28");
    assert.equal(lines[1].Amount, 490);
    assert.equal(lines[1].SalesItemLineDetail.ItemRef.value, "29");
    assert.equal(lines[1].Description, "Transport — livraison et récupération");
    assert.equal(lines[0].Amount + lines[1].Amount, 1950);
  });

  it("gives the distance when it is known, and names the kind of transport", () => {
    assert.equal(linesOf({ deliveryOption: "delivery", deliveryFeeCents: 49000, deliveryDistanceKm: 249.5 })[1].Description, "Transport — livraison et récupération, 249.5 km");
    assert.equal(linesOf({ deliveryOption: "delivery_only", deliveryFeeCents: 24500 })[1].Description, "Transport — livraison seulement");
    assert.equal(linesOf({ deliveryOption: "return_only", deliveryFeeCents: 24500 })[1].Description, "Transport — récupération seulement");
  });

  it("has no transport line for a free transport, and never a negative rental", () => {
    assert.equal(linesOf({ deliveryOption: "delivery", deliveryFeeCents: 0 }).length, 1);
    const lines = linesOf({ deliveryOption: "delivery", deliveryFeeCents: 999999 });
    assert.deepEqual(lines.map((line) => line.Amount), [0, 1950]);
  });

  it("prices every line before tax with the chosen tax code, and says whose booking it is", () => {
    const payload = buildInvoicePayload({ ...booking, deliveryOption: "delivery", deliveryFeeCents: 49000 }, ids, "2026-10-24");
    assert.equal(payload.GlobalTaxCalculation, "TaxExcluded");
    assert.equal(payload.CustomerRef.value, "69");
    assert.equal(payload.TxnDate, "2026-10-24");
    assert.equal(payload.BillEmail.Address, "riad@example.com");
    assert.equal(payload.PrivateNote, "Réservation ICEBOX res_1");
    for (const line of payload.Line as Line[]) {
      assert.equal(line.SalesItemLineDetail.TaxCodeRef.value, "5");
      assert.equal(line.SalesItemLineDetail.Qty, 1);
      assert.equal(line.SalesItemLineDetail.UnitPrice, line.Amount);
    }
  });
});
