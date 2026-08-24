import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { MapPin } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import client from "@/api/client";

const MAP_BG = { veg: "#0d1a0d", standard: "#0d0d1f" };

// pickupKm/totalKm are null whenever the partner has no fresh location ping on file (see
// buildOfferPayload) — true for every partner right now, since expo-location pings aren't wired
// until a later step. Showing the literal string "null km" would be a real, visible regression
// the moment real orders replace the mocks (which always had numbers here).
const formatKm = (km) => (km == null ? "—" : `${km} km`);

function MetricCell({ label, value }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text className="font-jakarta-bold text-lg text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

export default function IncomingOrder() {
  const navigation = useNavigation();
  const { params } = useRoute();
  // `params` IS the real order object now (orderId, restaurantName, fleetType, ... — the exact
  // shape server/services/deliveryAssignment.service.js's buildOfferPayload produces), pushed
  // either by the order_offer socket event or a GET /partner/orders/current resume (Home.jsx or
  // OrdersTab.jsx). Reached with no order at all shouldn't happen via normal navigation anymore,
  // but bail to Home rather than crash on order.fleetType below if it ever is.
  const order = params?.orderId ? params : null;

  const [secondsLeft, setSecondsLeft] = useState(order?.countdownSeconds ?? 0);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const skippedRef = useRef(false);

  useEffect(() => {
    if (!order) navigation.navigate("HomeOffline");
  }, [order, navigation]);

  // Explicit "Skip" tap — goes through the reason picker, which calls the real reject API.
  function handleSkip() {
    if (skippedRef.current) return;
    skippedRef.current = true;
    navigation.navigate("OrdersReject", { orderId: order.orderId });
  }

  // Countdown reaching 0 — the backend's own periodic sweep (server/socket.js's
  // sweepExpiredOffers) already expires and reassigns this offer server-side within ~5s
  // regardless of what the client does, so there's nothing to tell it here. Distinct from
  // handleSkip: no reason to collect, so this skips the picker sheet entirely.
  function handleTimeout() {
    if (skippedRef.current) return;
    skippedRef.current = true;
    navigation.navigate("OrdersSkipConfirmed");
  }

  useEffect(() => {
    if (!order || skippedRef.current) return; // already accepted/skipped, or nothing to count down
    if (secondsLeft <= 0) {
      handleTimeout();
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, order]);

  async function handleAccept() {
    if (skippedRef.current || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      await client.post(`/partner/orders/${order.orderId}/accept`);
      skippedRef.current = true;
      navigation.navigate("DeliveryPickup", { order });
    } catch (err) {
      if (err.code === "OFFER_EXPIRED" || err.code === "NOT_YOUR_OFFER") {
        skippedRef.current = true;
        navigation.navigate("HomeOffline");
      } else {
        setError(err.message);
        setAccepting(false);
      }
    }
  }

  if (!order) return null;

  const isVeg = order.fleetType === "veg";

  return (
    <View className="flex-1 bg-background">
      <View className="h-11 w-full" style={{ backgroundColor: "#1a1a1a" }} />

      <View
        className="h-[320px] w-full overflow-hidden pl-4 pr-4 pt-3"
        style={{ backgroundColor: MAP_BG[order.fleetType] }}
      >
        <View className="absolute" style={{ left: 55, top: 50, right: 24 }}>
          <View className="flex-row items-center gap-1.5">
            <View className="size-4 items-center justify-center rounded-full bg-primary">
              <View className="size-1.5 rounded-full bg-white" />
            </View>
            <Text className="text-[13px] text-[#ccc]">{order.restaurantName}</Text>
          </View>
          <View className="flex-row pl-2">
            <View className="h-40 w-[3px] rounded-full bg-primary" />
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="size-4 items-center justify-center rounded-full bg-success">
              <View className="size-1.5 rounded-full bg-white" />
            </View>
            <Text className="text-[13px] text-[#ccc]">Customer drop</Text>
          </View>
        </View>
      </View>

      <View className="w-full flex-1 gap-2 rounded-[20px] bg-card px-6 pt-[18px]">
        <Text className="w-full font-jakarta-bold text-lg text-foreground">
          {order.restaurantName}
        </Text>

        {!isVeg && (
          <View className="w-full flex-row items-center gap-1.5">
            <MapPin size={14} color="#8b1a1a" />
            <Text className="font-jakarta-semibold text-xs text-[#8b1a1a]">Non-veg order</Text>
          </View>
        )}

        {isVeg && (
          <View className="h-9 w-full flex-row items-center rounded-lg bg-success-tint px-3">
            <Text className="font-jakarta-semibold text-[13px] text-[#17803d]">
              Veg-Only order — use your certified bag
            </Text>
          </View>
        )}

        <View className="w-full flex-row items-center pt-0.5">
          <MetricCell label="Pickup" value={formatKm(order.pickupKm)} />
          <View className="h-8 w-px bg-border" />
          <MetricCell label="Drop" value={formatKm(order.dropKm)} />
          <View className="h-8 w-px bg-border" />
          <MetricCell label="Total" value={formatKm(order.totalKm)} />
        </View>

        <View className="h-[52px] w-full flex-row items-center gap-2 rounded-[20px] bg-primary-tint px-4">
          <Text className="font-jakarta-bold text-xl text-primary">₹{order.fare.toFixed(2)}</Text>
          <Text className="flex-1 font-jakarta-medium text-xs text-muted-foreground">
            {order.payment === "cod" ? `COD — collect ₹${order.codAmount}` : "Prepaid"}
          </Text>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <View className="w-full flex-row items-center gap-3 pt-2">
          <Button className="flex-1" disabled={accepting} onPress={handleAccept}>
            {accepting ? "Accepting…" : "Accept"}
          </Button>
          <Button className="flex-1" variant="secondary" disabled={accepting} onPress={handleSkip}>
            Skip
          </Button>
        </View>
      </View>

      <BottomNav />
    </View>
  );
}
