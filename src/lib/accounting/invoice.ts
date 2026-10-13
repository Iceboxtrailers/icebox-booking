import { DELIVERY_OPTION_LABEL_FR } from "@/lib/constants";
import type { DeliveryOption } from "@/lib/constants";

export type InvoiceSource = {
  reservationId: string;
  trailerSize: string | null;
  pickupDate: string | null; // YYYY-MM-DD
  returnDate: string | null; // YYYY-MM-DD
  nights: number | null;
  totalCents: number; // pre-tax, includes the transport fee
  deliveryFeeCents: number;
  deliveryOption: DeliveryOption;
  deliveryDistanceKm: number | null;
  clientEmail: string;
};

export type InvoiceIds = {
  customerId: string;
  rentalItemId: string;
  transportItemId: string;
  taxCodeId: string;
};

const dollars = (cents: number) => Math.round(cents) / 100;

// Lines are pre-tax; QuickBooks applies the selected GST/QST tax code itself
// (GlobalTaxCalculation "TaxExcluded"), so the invoice total matches what the
// customer saw on the site up to a possible 1-cent rounding difference.
export function buildInvoicePayload(src: InvoiceSource, ids: InvoiceIds, txnDate: string) {
  const transportCents = Math.min(Math.max(src.deliveryFeeCents, 0), src.totalCents);
  const rentalCents = src.totalCents - transportCents;

  const period =
    src.pickupDate && src.returnDate
      ? ` du ${src.pickupDate} au ${src.returnDate}${src.nights ? ` (${src.nights} jour${src.nights > 1 ? "s" : ""})` : ""}`
      : "";
  const rentalDescription = `Location de remorque réfrigérée${src.trailerSize ? ` ${src.trailerSize}` : ""}${period}`;

  const line = (description: string, cents: number, itemId: string) => ({
    DetailType: "SalesItemLineDetail",
    Amount: dollars(cents),
    Description: description,
    SalesItemLineDetail: {
      ItemRef: { value: itemId },
      Qty: 1,
      UnitPrice: dollars(cents),
      TaxCodeRef: { value: ids.taxCodeId },
    },
  });

  const lines = [line(rentalDescription, rentalCents, ids.rentalItemId)];
  if (transportCents > 0) {
    const km = src.deliveryDistanceKm !== null ? `, ${src.deliveryDistanceKm} km` : "";
    lines.push(
      line(
        `Transport — ${DELIVERY_OPTION_LABEL_FR[src.deliveryOption].toLowerCase()}${km}`,
        transportCents,
        ids.transportItemId,
      ),
    );
  }

  return {
    CustomerRef: { value: ids.customerId },
    TxnDate: txnDate,
    GlobalTaxCalculation: "TaxExcluded",
    BillEmail: { Address: src.clientEmail },
    PrivateNote: `Réservation ICEBOX ${src.reservationId}`,
    Line: lines,
  };
}
