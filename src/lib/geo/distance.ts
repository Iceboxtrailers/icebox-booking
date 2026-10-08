export const DEPOT_ADDRESS = "1005 rue du Parc-Industriel, Lévis, QC G6Z 1C5, Canada";

export class DistanceLookupError extends Error {}

// One-way driving distance from the depot, via the Google Routes API.
export async function getDrivingDistanceKm(destinationAddress: string): Promise<number> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new DistanceLookupError("GOOGLE_MAPS_API_KEY n'est pas configuré");

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { address: DEPOT_ADDRESS },
      destination: { address: destinationAddress },
      travelMode: "DRIVE",
      regionCode: "CA",
      languageCode: "fr-CA",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DistanceLookupError(`Google Routes ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { routes?: { distanceMeters?: number }[] };
  const meters = data.routes?.[0]?.distanceMeters;
  if (typeof meters !== "number") throw new DistanceLookupError("Aucun itinéraire trouvé pour cette adresse");
  return Math.round((meters / 1000) * 10) / 10;
}
