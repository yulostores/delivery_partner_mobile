// EXPO_PUBLIC_API_BASE — Expo's convention for client-exposed env vars (must
// be prefixed EXPO_PUBLIC_ to be inlined into the bundle). Unset in dev; set
// it to the real API origin once the backend exists.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "";

// Every screen has been wired to the real /api/partner/... routes (Steps 2-9 of the frontend
// integration plan) — confirmed via a full grep that nothing in src/ actually branches on this
// flag anymore (no `if (USE_MOCKS)` sites exist to remove). Kept as a named export rather than
// deleted outright in case a future screen ever needs a mock-data escape hatch again, but it does
// nothing today.
export const USE_MOCKS = false;
