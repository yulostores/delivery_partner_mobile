import { useQueryClient } from "@tanstack/react-query";

import NavigationScreen from "./NavigationScreen";
import client from "@/api/client";

async function handleArrive(queryClient, navigation, order) {
  // COD orders need cash collected before the trip can close; CodCollection.jsx's own "Confirm
  // delivery" button is what actually calls POST .../deliver for that path.
  if (order.payment === "cod") {
    navigation.navigate("DeliveryCodCollection", { order });
    return;
  }

  // Prepaid: nothing left to collect, so arriving at the customer IS the delivery-completion
  // moment — there's no separate confirm step on this path, unlike COD's CodCollection.jsx.
  // The explicit {} body matters: a truly bodyless POST leaves req.body undefined server-side,
  // and deliverSchema's z.object({...}) rejects undefined even though every field inside it is
  // optional — confirmed live, this 400s without it.
  await client.post(`/partner/orders/${order.orderId}/deliver`, {});
  // See CodCollection.jsx's identical invalidation — Home.jsx's earnings/cash-in-hand queries
  // would otherwise keep serving their pre-delivery snapshot to DeliverySummary.jsx for up to 60s.
  queryClient.invalidateQueries({ queryKey: ["partner", "earnings"] });
  navigation.navigate("DeliverySummary", { order });
}

export default function NavigateToCustomer() {
  const queryClient = useQueryClient();
  return (
    <NavigationScreen
      stage="dropoff"
      mapLabel="Navigate to customer"
      onArrive={(navigation, order) => handleArrive(queryClient, navigation, order)}
    />
  );
}
