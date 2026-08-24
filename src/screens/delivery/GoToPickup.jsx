import NavigationScreen from "./NavigationScreen";

// Just a screen transition — no API call happens here. The real pickup verification (OTP +
// veg checklist) happens on VegCheckpoint.jsx's own "Confirm pickup" button.
function handleArrive(navigation, order) {
  navigation.navigate("DeliveryVegCheckpoint", { order });
}

export default function GoToPickup() {
  return <NavigationScreen stage="pickup" mapLabel="Navigate to restaurant" onArrive={handleArrive} />;
}
