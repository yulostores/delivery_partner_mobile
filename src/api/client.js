import axios from "axios";
import { API_BASE } from "./config";
import { getRefreshToken, clearRefreshToken } from "./tokenStorage";

// Access token lives in memory only.
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
}
export function getAccessToken() {
  return _accessToken;
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

client.interceptors.request.use((config) => {
  const token = getAccessToken();
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
let _refreshing = false;
let _queue = [];

const REFRESHABLE_CODES = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN"]);

client.interceptors.response.use(
  (res) => res.data.data,
  async (err) => {
    const original = err.config;
    const code = err.response?.data?.code;

    if (err.response?.status === 401 && REFRESHABLE_CODES.has(code) && original && !original._retried) {
      original._retried = true;

      if (_refreshing) {
        return new Promise((resolve, reject) => _queue.push({ resolve, reject })).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      _refreshing = true;
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw err; // nothing to refresh with — fall through to session-expired

        const { data } = await axios.post(`${API_BASE}/api/partner/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        setAccessToken(newToken);
        _queue.forEach(({ resolve }) => resolve(newToken));
        _queue = [];
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch (refreshErr) {
        setAccessToken(null);
        await clearRefreshToken();
        _queue.forEach(({ reject }) => reject(refreshErr));
        _queue = [];
        return Promise.reject(refreshErr);
      } finally {
        _refreshing = false;
      }
    }

    if (!err.response) {
      console.error("[DEBUG network error]", {
        message: err.message,
        code: err.code,
        baseURL: err.config?.baseURL,
        url: err.config?.url,
      });
    }

    const message = err.response?.data?.message ?? err.message ?? "Request failed";
    const apiError = new Error(message);
    apiError.code = code;
    apiError.status = err.response?.status;
    apiError.details = err.response?.data?.details;
    return Promise.reject(apiError);
  },
);

export default client;
