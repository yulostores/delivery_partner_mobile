import { Alert, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import NavigationScreen from "./NavigationScreen";
import client from "@/api/client";

const HANDOVER_TITLE = "Handed the order over?";
const HANDOVER_BODY = "Mark it delivered only once the customer has their order.";

// Resolves true only on "Mark delivered" (Back / tapping outside counts as "Not yet").
// On web react-native-web's Alert.alert does nothing at all, so this promise never settled and
// the web build's button sat on "Please wait…" for good — the browser's own confirm instead.
const confirmHandover = () =>
  new Promise((resolve) => {
    if (Platform.OS === "web") {
      resolve(window.confirm(`${HANDOVER_TITLE}\n\n${HANDOVER_BODY}`));
      return;
    }
    Alert.alert(
      HANDOVER_TITLE,
      HANDOVER_BODY,
      [
        { text: "Not yet", style: "cancel", onPress: () => resolve(false) },
        { text: "Mark delivered", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

async function handleArrive(queryClient, navigation, order) {
  // COD orders need cash collected before the trip can close; CodCollection.jsx's own "Confirm
  // delivery" button is what actually calls POST .../deliver for that path. Decided by the order,
  // not by the COD switch: while COD is off no new order is cash-on-delivery, but one placed
  // before it was switched off still has cash to collect.
  if (order.payment === "cod") {
    navigation.navigate("DeliveryCodCollection", { order });
    return;
  }

  // Prepaid: nothing left to collect, so this tap completes the delivery. It used to read
  // "Reached customer" and close the order on arrival, before any handover; the button now says
  // what it does and asks once, so a tap on arrival can't mark undelivered food delivered.
  if (!(await confirmHandover())) return;
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
      arriveLabel={(order) => (order?.payment === "cod" ? "Reached customer" : "Handed over — mark delivered")}
    />
  );
}
