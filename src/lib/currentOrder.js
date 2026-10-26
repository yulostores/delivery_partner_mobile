import client from "@/api/client";
import { getCurrentRoute, navigate } from "@/navigation/navigationRef";

// Screens that belong to one offer or delivery. A rider already on any of them for the same
// order is left where they are — returning to the app from a UPI app on the cash screen, or from
// the dialer, must not throw them back to the map.
const ORDER_FLOW_SCREENS = new Set([
  "OrdersIncoming",
  "OrdersReject",
  "DeliveryPickup",
  "DeliveryVegCheckpoint",
  "DeliveryNavigate",
  "DeliveryCodCollection",
  "DeliveryPaymentReceived",
]);

const shownOrderId = (route) => route?.params?.order?.orderId ?? route?.params?.orderId ?? null;

/**
 * Opens whatever the backend says is in flight for this rider — an offer still waiting on an
 * answer, or an order already accepted — instead of leaving them on Home after the app was
 * backgrounded, reopened, or opened from a notification. Best-effort: on any failure the rider
 * simply stays where they are.
 */
export async function resumeCurrentOrder() {
  try {
    const { kind, order } = await client.get("/partner/orders/current");
    if (kind !== "offer" && kind !== "assigned") return;

    const route = getCurrentRoute();
    if (ORDER_FLOW_SCREENS.has(route?.name) && String(shownOrderId(route)) === String(order.orderId)) return;

    if (kind === "offer") {
      navigate("OrdersIncoming", order);
    } else {
      // After pickup the rider belongs on the customer-facing leg, not back on pickup
      // (order.assignmentStatus — see yulo_backend's buildOfferPayload).
      navigate(order.assignmentStatus === "picked_up" ? "DeliveryNavigate" : "DeliveryPickup", { order });
    }
  } catch {
    // best-effort — see above
  }
}
