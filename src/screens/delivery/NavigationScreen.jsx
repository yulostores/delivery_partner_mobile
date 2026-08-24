import { useEffect, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { PhoneCall } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

// Shared by "Go to Pickup" and "Navigate to Customer" — same layout in the
// Figma design (map header + destination sheet with ETA/call/CTA), differing
// only in which leg of the trip they show. `stage` picks pickup vs drop-off
// fields off the order; `onArrive` decides where the CTA routes to (and, since
// Step 6, may itself call a real API — e.g. NavigateToCustomer.jsx's prepaid-delivery
// call — so it's awaited here with its own busy/error state).
export default function NavigationScreen({ stage, mapLabel, onArrive }) {
  const navigation = useNavigation();
  const { params } = useRoute();
  const order = params?.order;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Reached with no real order (e.g. a stale/direct navigation) — bail to Home rather than crash
  // reading order.restaurantName etc. below. Matches IncomingOrder.jsx's same guard from Step 5.
  useEffect(() => {
    if (!order) navigation.navigate("HomeOffline");
  }, [order, navigation]);

  if (!order) return null;

  const isPickup = stage === "pickup";
  const name = isPickup ? order.restaurantName : order.customerName;
  const address = isPickup ? order.restaurantAddress : order.customerAddress;
  const etaMin = isPickup ? order.pickupEtaMin : order.customerEtaMin;
  const km = isPickup ? order.pickupKm : order.dropKm;

  async function handleArrive() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onArrive(navigation, order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="h-11 w-full bg-background" />

      <View
        className="h-[380px] w-full overflow-hidden bg-[#e8f2e8] px-4 pt-3"
        accessible
        accessibilityLabel={`${mapLabel} · ${km != null ? `${km} km` : "distance unknown"}`}
      >
        <View className="absolute h-52 w-4 items-center" style={{ left: 189, top: 60 }}>
          <View className="size-4 rounded-full bg-primary" />
          <View className="w-1 flex-1 bg-primary" />
          <View className="size-4 rounded-full bg-success" />
        </View>
      </View>

      <View className="w-full flex-1 gap-4 rounded-[20px] bg-card px-6 pb-6 pt-4 shadow-md shadow-black/10">
        <View className="w-full flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="font-jakarta-bold text-lg text-foreground">{name}</Text>
            <Text className="text-sm text-muted-foreground">{address}</Text>
          </View>
          <View className="size-12 items-center justify-center rounded-full border-[1.5px] border-border">
            <PhoneCall size={20} color="#1a1a1a" />
          </View>
        </View>

        <View className="w-full flex-row items-center pt-1.5">
          <View className="h-7 items-center justify-center rounded-full bg-primary-tint px-3">
            <Text className="font-jakarta-semibold text-xs text-[#d9480f]">
              ETA · {etaMin != null ? `${etaMin} min` : "—"}
            </Text>
          </View>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Button disabled={busy} onPress={handleArrive}>
          {busy ? "Please wait…" : isPickup ? "Reached restaurant" : "Reached customer"}
        </Button>
      </View>
    </View>
  );
}
