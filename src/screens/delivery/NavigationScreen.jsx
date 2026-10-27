import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { PhoneCall } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import DeliveryMap from "@/components/delivery/DeliveryMap";
import { isOrderGone, leaveGoneOrder } from "@/lib/orderGone";
import { goToTab } from "@/navigation/tabs";

// Turn-by-turn directions in Google Maps (the app on Android, the website elsewhere). Goes by the
// coordinates when the order has them ([lng, lat], as on the map above) — more exact than an
// address, which Maps has to search for — and by the address text otherwise.
// dir_action=navigate starts navigation straight away; two-wheeler is Maps' bike-and-scooter mode.
export function googleMapsDirectionsUrl(destination, address) {
  const target =
    Array.isArray(destination) && destination.length === 2
      ? `${destination[1]},${destination[0]}`
      : address;
  if (!target) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=two-wheeler&dir_action=navigate`;
}

// Shared by "Go to Pickup" and "Navigate to Customer" — same layout in the
// Figma design (map header + destination sheet with ETA/call/CTA), differing
// only in which leg of the trip they show. `stage` picks pickup vs drop-off
// fields off the order; `onArrive` decides where the CTA routes to (and, since
// Step 6, may itself call a real API — e.g. NavigateToCustomer.jsx's prepaid-delivery
// call — so it's awaited here with its own busy/error state).
//
// The map (DeliveryMap, platform-split — see its .native/.web files) replaces
// what used to be a hardcoded pair of circles at a fixed pixel position (never
// actually reflected any real coordinate). It's fed order.restaurantLocation/
// dropoffLocation — raw [lng, lat] pairs added to the backend's
// buildOfferPayload specifically for this (yulo_backend's
// deliveryAssignment.service.js).
export default function NavigationScreen({ stage, mapLabel, onArrive }) {
  const navigation = useNavigation();
  const { params } = useRoute();
  const order = params?.order;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [linkError, setLinkError] = useState(null);

  // Reached with no real order (e.g. a stale/direct navigation) — bail to Home rather than crash
  // reading order.restaurantName etc. below. Matches IncomingOrder.jsx's same guard from Step 5.
  useEffect(() => {
    if (!order) goToTab("HomeOffline");
  }, [order, navigation]);

  if (!order) return null;

  const isPickup = stage === "pickup";
  const name = isPickup ? order.restaurantName : order.customerName;
  const address = isPickup ? order.restaurantAddress : order.customerAddress;
  const etaMin = isPickup ? order.pickupEtaMin : order.customerEtaMin;
  const km = isPickup ? order.pickupKm : order.dropKm;
  // The flat number and the landmark, called out rather than left mid-line in the address
  // string — they are what actually gets a rider to a door, and the address above is one
  // comma-joined line they have to read through while holding a bag. Only on the drop leg;
  // a restaurant has no flat number. Null on orders placed before addresses were stored in
  // parts, in which case `address` above still contains them.
  const houseNumber = isPickup ? null : order.customerHouseNumber;
  const landmark = isPickup ? null : order.customerLandmark;
  const destination = isPickup ? order.restaurantLocation : order.dropoffLocation;
  // The offer payload carries the customer's number (buildOfferPayload) but no restaurant number,
  // so the call button only appears on the drop-off leg.
  const phone = isPickup ? null : order.customerPhone;

  const mapsUrl = googleMapsDirectionsUrl(destination, address);

  function handleCall() {
    setLinkError(null);
    Linking.openURL(`tel:${String(phone).replace(/[^\d+]/g, "")}`).catch(() =>
      setLinkError(`Couldn’t open the dialer — call ${phone}`),
    );
  }

  function handleOpenMaps() {
    setLinkError(null);
    Linking.openURL(mapsUrl).catch(() => setLinkError("Couldn’t open Google Maps on this phone."));
  }

  async function handleArrive() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onArrive(navigation, order);
    } catch (err) {
      // Cancelled or reassigned on the way: the delivery call is refused — leave the flow.
      if (isOrderGone(err)) leaveGoneOrder(err.code);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <View className="h-11 w-full bg-background" />

      <View
        className="h-[380px] w-full overflow-hidden bg-[#e8f2e8]"
        accessible
        accessibilityLabel={`${mapLabel} · ${km != null ? `${km} km` : "distance unknown"}`}
      >
        <DeliveryMap destination={destination} />
      </View>

      <View className="w-full flex-1 gap-4 rounded-[20px] bg-card px-6 pb-6 pt-4 shadow-md shadow-black/10">
        <View className="w-full flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="font-jakarta-bold text-lg text-foreground">{name}</Text>
            {houseNumber ? (
              <Text className="font-jakarta-bold text-base text-foreground">{houseNumber}</Text>
            ) : null}
            <Text className="text-sm text-muted-foreground">{address}</Text>
            {landmark ? (
              <Text className="text-sm text-muted-foreground">Landmark: {landmark}</Text>
            ) : null}
          </View>
          {phone ? (
            <Pressable
              onPress={handleCall}
              accessibilityRole="button"
              accessibilityLabel={`Call ${name ?? "customer"}`}
              hitSlop={8}
              className="size-12 items-center justify-center rounded-full border-[1.5px] border-border"
            >
              <PhoneCall size={20} color="#1a1a1a" />
            </Pressable>
          ) : null}
        </View>

        <View className="w-full flex-row items-center pt-1.5">
          <View className="h-7 items-center justify-center rounded-full bg-primary-tint px-3">
            <Text className="font-jakarta-semibold text-xs text-[#d9480f]">
              ETA · {etaMin != null ? `${etaMin} min` : "—"}
            </Text>
          </View>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}
        {linkError && <Text className="text-center text-sm text-destructive">{linkError}</Text>}

        {mapsUrl ? (
          <Button variant="secondary" size="sm" onPress={handleOpenMaps}>
            Open in Google Maps
          </Button>
        ) : null}

        <Button disabled={busy} onPress={handleArrive}>
          {busy ? "Please wait…" : isPickup ? "Reached restaurant" : "Reached customer"}
        </Button>
      </View>
    </View>
  );
}
