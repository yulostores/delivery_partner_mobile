import axios from "axios";
import { API_BASE } from "./config";
import { getRefreshToken, clearRefreshToken } from "./tokenStorage";

// Access token lives in memory only.
let _accessToken = null;
// When it was handed to us — partner access tokens last 15 minutes (server JWT_PARTNER_ACCESS_EXPIRES),
// so anything that must not present an expired one (the socket join) can tell when to refresh.
let _accessTokenAt = 0;
// Bumped whenever the session ends (token cleared). A refresh started before that — by a location
// ping or the socket — must not put the signed-out rider's token back when it lands afterwards.
let _sessionGeneration = 0;

export function setAccessToken(token) {
  if (!token) _sessionGeneration += 1;
  _accessToken = token;
  _accessTokenAt = token ? Date.now() : 0;
}
export function getAccessToken() {
  return _accessToken;
}

// Told when the server refuses the refresh token (it expired after 30 days, or was revoked), so
// the app can send the rider back to sign-in. Clearing the tokens alone left the app looking
// signed in while every screen failed with 401.
let _onSessionExpired = null;
export function setSessionExpiredHandler(handler) {
  _onSessionExpired = handler;
}

// Sign-in calls carry no token; logout does (the server needs it to revoke the session).
const PUBLIC_AUTH_PATHS = new Set(["/partner/auth/request-otp", "/partner/auth/verify-otp", "/partner/auth/refresh"]);

// One refresh at a time, however many callers ask at once.
let _refreshPromise = null;

/**
 * Mints a new access token from the stored refresh token. Resolves the token, or null when there
 * is no session to refresh (signed out, or the refresh token was revoked/expired).
 */
export function refreshAccessToken() {
  if (!_refreshPromise) {
    const generation = _sessionGeneration;
    _refreshPromise = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) return null;
        const { data } = await axios.post(`${API_BASE}/api/partner/auth/refresh`, { refreshToken });
        if (generation !== _sessionGeneration) return null; // signed out while this was in flight
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      } catch (err) {
        // Only a refused refresh means the session is over; a network blip keeps it. Reported from
        // here so every caller (screens, the socket, background location pings) ends it the same way.
        if (err?.response?.status === 401 || err?.response?.status === 400) {
          if (generation === _sessionGeneration) _onSessionExpired?.();
          return null;
        }
        throw err;
      } finally {
        _refreshPromise = null;
      }
    })();
  }
  return _refreshPromise;
}

// Refresh this long before the 15-minute expiry, so a token is never presented in its last minutes.
const FRESH_FOR_MS = 10 * 60 * 1000;

/** An access token that will still be valid for a while — refreshed first if it is getting old. */
export async function getFreshAccessToken() {
  if (_accessToken && Date.now() - _accessTokenAt < FRESH_FOR_MS) return _accessToken;
  return refreshAccessToken();
}

// Single Axios instance for all API calls. Unlike the browser admin client,
// RN has no cookie jar — the refresh token comes from SecureStore (see
// tokenStorage.js) and is sent explicitly in the request body, not via
// `withCredentials`.
// No hardcoded Content-Type default: axios's own transformRequest sets
// 'application/json' automatically for plain object bodies (its own fallback
// only sets it when nothing else is already present), but a hardcoded default here would
// force it onto every request — including multipart FormData uploads. axios explicitly
// JSON-stringifies FormData bodies when a JSON content-type is already set (see
// axios/lib/defaults/index.js's transformRequest), silently discarding the file. Confirmed live:
// document uploads sent a literal "[object FormData]" string body until this was removed.
const client = axios.create({
  baseURL: `${API_BASE}/api`,
});

client.interceptors.request.use(async (config) => {
  let token = getAccessToken();
  // No token in memory but a session on the phone (app opened offline, or a fresh JS context):
  // mint one first. Sent with no token at all, the request would fail with an error the
  // refresh-on-401 below doesn't retry. Sign-in calls themselves never need one.
  if (!token && !PUBLIC_AUTH_PATHS.has(config.url)) {
    token = await refreshAccessToken().catch(() => null);
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — envelope unwrap + auto-refresh ───────────────────
// Every real backend response is wrapped as { status, message, data } (see
// server/utils/ApiResponse.js). On success, hand callers `data` directly —
// plain objects, no envelope, so every screen consumes this the same way
// regardless of which endpoint it's calling.
//
// Refresh trigger: authenticatePartner (server/middleware/authenticatePartner.js)
// throws ApiError(401, 'INVALID_TOKEN', ...) itself only for blacklisted/suspended/
// not-found — none of those are fixable by refreshing. The actual "access token
// expired, please refresh" case never reaches that code at all: jwt.verify throws
// its own TokenExpiredError first, which server/middleware/errorHandler.js maps to
// 401 code 'TOKEN_EXPIRED' (confirmed directly against both files, and by triggering
// a real expired-token error) — the same code admin-client/src/api/client.js already
// keys its own refresh trigger on. So this checks TOKEN_EXPIRED as the primary case,
// and INVALID_TOKEN too (harmless if it turns out not to be refreshable — the refresh
// call itself will then fail and this correctly falls through to session-expired
// below, at the cost of one extra round trip).
const REFRESHABLE_CODES = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN"]);

client.interceptors.response.use(
  (res) => res.data.data,
  async (err) => {
    const original = err.config;
    const code = err.response?.data?.code;

    if (err.response?.status === 401 && REFRESHABLE_CODES.has(code) && original && !original._retried) {
      original._retried = true;

      // refreshAccessToken() shares one in-flight refresh between every caller (this
      // interceptor, the socket join, background location pings).
      let newToken;
      try {
        newToken = await refreshAccessToken();
      } catch (refreshErr) {
        // Network failure while refreshing: the session is still good — fail just this request.
        // (Clearing the session here used to sign a rider out on one dropped connection.)
        return Promise.reject(refreshErr);
      }
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      }
      // The server refused the refresh token: the session really is over. Falls through to
      // report this request's 401 like any other error.
      setAccessToken(null);
      await clearRefreshToken();
    }

    // No response at all (offline, server restarting, request timed out). Logged for development
    // only, as a warning — a red error banner on every dropped request made riders' network
    // blips look like crashes; the screen shows its own message either way.
    if (!err.response && __DEV__) {
      console.warn("[network error]", {
        message: err.message,
        code: err.code,
        baseURL: err.config?.baseURL,
        url: err.config?.url,
      });
    }

    // No response at all: axios's own "Network Error" / "timeout of …ms exceeded" meant nothing
    // to a rider, and every screen shows this message as-is.
    const message =
      err.response?.data?.message ??
      (err.response ? err.message : "Can’t reach Yulo right now — check your internet connection and try again.") ??
      "Request failed";
    const apiError = new Error(message);
    apiError.code = code;
    apiError.status = err.response?.status;
    apiError.details = err.response?.data?.details;
    return Promise.reject(apiError);
  },
);

export default client;
