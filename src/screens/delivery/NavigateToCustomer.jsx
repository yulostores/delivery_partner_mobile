import NavigationScreen from "./NavigationScreen";

function handleArrive(navigation, order) {
  // COD orders need cash collected before the trip can close; CodCollection.jsx's own "Confirm
  // delivery" button is what actually calls POST .../deliver for that path. Decided by the order,
  // not by the COD switch: while COD is off no new order is cash-on-delivery, but one placed
  // before it was switched off still has cash to collect.
  if (order.payment === "cod") {
    navigation.navigate("DeliveryCodCollection", { order });
    return;
  }
  // Prepaid: the handover screen asks for the customer's delivery code, which is what marks the
  // order delivered. A yes/no confirm used to — a tap anyone could make without reaching the door.
  navigation.navigate("DeliveryHandover", { order });
}

export default function NavigateToCustomer() {
  return (
    <NavigationScreen
      stage="dropoff"
      mapLabel="Navigate to customer"
      onArrive={(navigation, order) => handleArrive(navigation, order)}
      arriveLabel={() => "Reached customer"}
    />
  );
}
