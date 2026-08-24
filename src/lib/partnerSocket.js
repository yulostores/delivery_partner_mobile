import { io } from "socket.io-client";
import { API_BASE } from "@/api/config";
import { getAccessToken } from "@/api/client";
import { navigate } from "@/navigation/navigationRef";

// Connects to the bare server origin, not `${API_BASE}/api` — Socket.IO attaches directly to the
// HTTP server (server/socket.js's initSocket(httpServer)) on its own default path, independent of
// the Express `/api` prefix the REST client uses.
let _socket = null;

// Matches server/socket.js's join_partner handler exactly: it expects `{ token }` and joins the
// socket to room `partner:{partnerId}` after verifying the token against JWT_PARTNER_SECRET,
// disconnecting the socket outright if verification fails.
//
// The access token is read fresh (via getAccessToken()) inside the "connect" handler rather than
// captured as a parameter, and re-runs on every "connect" event — socket.io-client fires "connect"
// again after every automatic reconnection, not just the first one, so this naturally re-emits
// join_partner (and the server's handler re-adds this partner to live:active_partners) on every
// reconnect. Capturing the token by value instead would silently break rejoin after the access
// token rotates (a real scenario: the socket can outlive several access-token refreshes).
export function connectPartnerSocket() {
  // Reuse/reconnect the existing socket rather than always creating a new `io()` instance —
  // doing the latter whenever `_socket` exists but happens to be momentarily disconnected (e.g.
  // mid automatic-reconnect) would orphan the old instance's timers/listeners instead of just
  // resuming it.
  if (_socket) {
    if (!_socket.connected) _socket.connect();
    return _socket;
  }

  _socket = io(API_BASE, { transports: ["websocket"] });

  _socket.on("connect", () => {
    const token = getAccessToken();
    if (token) _socket.emit("join_partner", { token });
  });

  // Registered once per socket instance (not per reconnect, unlike "connect" above) — this is a
  // plain message handler, not a connection-lifecycle hook, so it stays attached for the whole
  // life of this socket regardless of how many times the transport reconnects underneath it.
  // Fires regardless of which screen is currently focused: the payload IS the order object
  // IncomingOrder.jsx expects as its route params (see
  // server/services/deliveryAssignment.service.js's buildOfferPayload), not a key to look up.
  _socket.on("order_offer", (payload) => {
    navigate("OrdersIncoming", payload);
  });

  return _socket;
}

export function disconnectPartnerSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export function getPartnerSocket() {
  return _socket;
}
