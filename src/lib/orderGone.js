import { getCurrentRoute, navigate } from "@/navigation/navigationRef";

// A delivery the rider can no longer do: the customer, restaurant or Yulo cancelled it, or it was
// reassigned. The backend refuses accept / verify-pickup / deliver on it with one of these codes
// (server/controllers/partner/order.controller.js) and, for a cancellation, also pushes
// `order_cancelled { orderId }` to the rider's socket room.
export const ORDER_GONE_CODES = new Set(["ORDER_CANCELLED", "ORDER_UNAVAILABLE"]);

export const isOrderGone = (err) => ORDER_GONE_CODES.has(err?.code);

const NOTICES = {
  ORDER_CANCELLED: "Order cancelled — no need to deliver.",
  ORDER_UNAVAILABLE: "This order is no longer yours — it was reassigned.",
};

/** Leaves the delivery flow for Home, which shows why. */
export function leaveGoneOrder(code = "ORDER_CANCELLED") {
  navigate("HomeOffline", { notice: NOTICES[code] ?? NOTICES.ORDER_CANCELLED, noticeAt: Date.now() });
}

// The order a delivery-flow screen is showing: the offer card's params are the order itself;
// the pickup / drop-off / payment screens carry it as `params.order`.
const shownOrderId = (route) => route?.params?.order?.orderId ?? route?.params?.orderId ?? null;

/**
 * The `order_cancelled` socket push. Only acts when the cancelled order is the one on screen —
 * a rider on Home or Earnings is left alone.
 */
export function handleOrderCancelledPush(payload) {
  const route = getCurrentRoute();
  const orderId = payload?.orderId;
  if (orderId && String(shownOrderId(route)) === String(orderId)) leaveGoneOrder("ORDER_CANCELLED");
}
