import * as Location from "expo-location";
import client from "@/api/client";

// Meaningfully shorter than the backend's LOCATION_FRESHNESS_SECONDS (120s, see
// server/services/geo.service.js) so a ping always lands well before the previous one goes stale.
const PING_INTERVAL_MS = 30_000;

let _intervalId = null;

async function pingOnce() {
  try {
    const { coords } = await Location.getCurrentPositionAsync({});
    await client.post("/partner/location", { coordinates: [coords.longitude, coords.latitude] });
  } catch {
    // Best-effort — a single failed ping (GPS momentarily unavailable, request hiccup) isn't
    // fatal, the next interval tick tries again.
  }
}

// Safe to call repeatedly — a no-op if already running. Requests foreground location permission
// and simply does nothing (rather than blocking the caller) if it's denied: a partner without
// location permission can still go online and receive offers, just without distance-based
// priority in ranking (see deliveryAssignment.service.js's rankCandidates).
export async function startLocationPings() {
  if (_intervalId) return;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return;

  await pingOnce();
  _intervalId = setInterval(pingOnce, PING_INTERVAL_MS);
}

export function stopLocationPings() {
  clearInterval(_intervalId);
  _intervalId = null;
}
