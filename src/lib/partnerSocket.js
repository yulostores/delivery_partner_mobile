import { io } from "socket.io-client";
import { API_BASE } from "@/api/config";
import { getFreshAccessToken, refreshAccessToken } from "@/api/client";
import { navigate } from "@/navigation/navigationRef";
import { handleOrderCancelledPush } from "@/lib/orderGone";
import { alertNewOffer } from "@/lib/pushNotifications";

// Connects to the bare server origin, not `${API_BASE}/api` — Socket.IO attaches directly to the
// HTTP server (server/socket.js's initSocket(httpServer)) on its own default path, independent of
// the Express `/api` prefix the REST client uses.
let _socket = null;
// True between connectPartnerSocket() and disconnectPartnerSocket(): the rider is on duty and the
// socket should stay up, whatever the network or the server does to it.
let _wanted = false;
let _retryTimer = null;
let _failedJoins = 0;

const JOIN_TIMEOUT_MS = 10_000;

// Joins room `partner:{partnerId}` (server/socket.js join_partner), which is what makes this rider
// reachable for offers. Runs on every "connect" — socket.io-client fires it again after each
// automatic reconnection — with a token that is refreshed first if it is getting old.
//
// Why the refresh matters: partner access tokens last 15 minutes. The app used to rejoin with
// whatever token it held, and after a reconnect that was often an expired one. The server then
// dropped the socket, socket.io-client never reconnects a socket the server closed, and the rider
// stopped receiving orders while the screen still said "Online".
async function join(socket) {
  let token;
  try {
    token = await getFreshAccessToken();
  } catch {
    token = null; // offline right now — retried below
  }
  if (!token) {
    scheduleRetry();
    return;
  }
  socket.timeout(JOIN_TIMEOUT_MS).emit("join_partner", { token }, (err, res) => {
    // No answer: an older server that doesn't acknowledge — the join itself still happened.
    if (err) return;
    if (res?.ok) {
      _failedJoins = 0;
      return;
    }
    // Refused (the server closes the socket right after): get a new token and try again.
    refreshAccessToken()
      .catch(() => null)
      .finally(scheduleRetry);
  });
}

// Reconnects a socket that is down for a reason socket.io-client won't recover from by itself
// (the server closed it, or the join was refused). Backs off so a signed-out rider isn't hammering
// the server: 2s, 4s, 8s … capped at a minute.
function scheduleRetry() {
  if (!_wanted || _retryTimer) return;
  _failedJoins += 1;
  const delay = Math.min(60_000, 1000 * 2 ** Math.min(_failedJoins, 6));
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    if (!_wanted || !_socket) return;
    if (_socket.connected) join(_socket);
    else _socket.connect();
  }, delay);
}

export function connectPartnerSocket() {
  _wanted = true;
  // Reuse/reconnect the existing socket rather than always creating a new `io()` instance —
  // doing the latter whenever `_socket` exists but happens to be momentarily disconnected (e.g.
  // mid automatic-reconnect) would orphan the old instance's timers/listeners instead of just
  // resuming it.
  if (_socket) {
    if (!_socket.connected) _socket.connect();
    return _socket;
  }

  _socket = io(API_BASE, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
  const socket = _socket;

  socket.on("connect", () => join(socket));

  // "io server disconnect" is the one reason socket.io-client does not reconnect from on its own.
  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") scheduleRetry();
  });

  // Registered once per socket instance — stays attached however many times the transport
  // reconnects underneath it. The payload IS the order object IncomingOrder.jsx expects as its
  // route params (server/services/deliveryAssignment.service.js's buildOfferPayload).
  socket.on("order_offer", (payload) => {
    alertNewOffer();
    navigate("OrdersIncoming", payload);
  });

  // The order on screen was cancelled (by the customer, restaurant or Yulo) — drop it and go back
  // to Home with a notice; picking it up or delivering it would be refused anyway.
  socket.on("order_cancelled", handleOrderCancelledPush);

  return socket;
}

export function disconnectPartnerSocket() {
  _wanted = false;
  clearTimeout(_retryTimer);
  _retryTimer = null;
  _failedJoins = 0;
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

export function getPartnerSocket() {
  return _socket;
}
