import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import DeliveryMap from "@/components/delivery/DeliveryMap";
import BottomNav from "@/components/partner/BottomNav";
import client from "@/api/client";
import { formatCurrency } from "@/lib/format";
import { isOrderGone, leaveGoneOrder } from "@/lib/orderGone";
import { getCurrentRoute } from "@/navigation/navigationRef";
import { goToTab, leaveOffer } from "@/navigation/tabs";

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
    if (!order) goToTab("HomeOffline");
  }, [order, navigation]);

  // Explicit "Skip" tap — goes through the reason picker, which calls the real reject API. Doesn't
  // mark the offer as finished: the rider can close the picker and still accept, and the countdown
  // keeps running underneath it (the picker sends them on when it actually rejects).
  function handleSkip() {
    if (skippedRef.current || accepting) return;
    navigation.navigate("OrdersReject", { orderId: order.orderId });
  }

  // Countdown reaching 0 — the backend's own periodic sweep (server/socket.js's
  // sweepExpiredOffers) already expires and reassigns this offer server-side within ~5s
  // regardless of what the client does, so there's nothing to tell it here. Distinct from
  // handleSkip: no reason to collect, so this skips the picker sheet entirely.
  function handleTimeout() {
    if (skippedRef.current) return;
    skippedRef.current = true;
    // Only moves the rider on if they are still looking at this offer (or its skip picker) — not
    // when the picker already rejected it and they have moved on.
    const current = getCurrentRoute();
    const onThisOffer =
      (current?.name === "OrdersIncoming" || current?.name === "OrdersReject") &&
      String(current.params?.orderId) === String(order.orderId);
    // `timedOut`: the rider didn't skip — the offer ran out — and the screen says so.
    if (onThisOffer) leaveOffer(navigation, "OrdersSkipConfirmed", { timedOut: true });
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
      leaveOffer(navigation, "DeliveryPickup", { order });
    } catch (err) {
      if (err.code === "OFFER_EXPIRED" || err.code === "NOT_YOUR_OFFER") {
        skippedRef.current = true;
        goToTab("HomeOffline");
      } else if (isOrderGone(err)) {
        // Cancelled (or reassigned) while the offer was on screen.
        skippedRef.current = true;
        leaveGoneOrder(err.code);
      } else {
        setError(err.message);
        setAccepting(false);
      }
    }
  }

  if (!order) return null;

  // From the ORDER, not the rider: `fleetType` is the rider's own fleet (the server sets it from the
  // partner being offered), so it called every standard-fleet offer "Non-veg" — an all-veg order
  // included. What the rider needs to know is whether this order needs the certified veg bag.
  const isVegOrder = Boolean(order.dedicatedBagRequired || order.vegFleetOptIn);

  return (
    // Safe-area top and bottom: Android draws the app edge to edge, so without the bottom inset
    // the bottom bar sat behind the phone's own navigation bar and its taps went to the system
    // bar instead (Home / Orders / Earn / Profile "not working" on this screen).
    <Screen edges={["top", "bottom"]}>

      {/* The trip on a real map: rider (their live position), restaurant and customer. Was a
          drawn diagram (two dots and a line on a dark panel) that said nothing about where the
          order actually is. The key stays over the map; the panel colour shows while tiles load. */}
      <View className="h-[320px] w-full overflow-hidden" style={{ backgroundColor: MAP_BG[order.fleetType] }}>
        <DeliveryMap pickup={order.restaurantLocation ?? undefined} destination={order.dropoffLocation ?? undefined} />
        <View className="absolute left-3 top-3 gap-1 rounded-xl bg-white/90 px-3 py-2" pointerEvents="none">
          <View className="flex-row items-center gap-1.5">
            <View className="size-3 rounded-full bg-primary" />
            <Text className="text-xs text-foreground">{order.restaurantName}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="size-3 rounded-full bg-success" />
            <Text className="text-xs text-foreground">Customer drop</Text>
          </View>
        </View>
      </View>

      <View className="w-full flex-1 gap-2 rounded-[20px] bg-card px-6 pt-[18px]">
        <Text className="w-full font-jakarta-bold text-lg text-foreground">
          {order.restaurantName}
        </Text>

        {isVegOrder && (
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

        {/* fare is the server's figure for this delivery — base + distance pay + the customer's
            tip, the same breakdown frozen onto the order on Accept. codAmount is everything the
            customer owes (food, fees, GST and tip). */}
        <View className="h-[52px] w-full flex-row items-center gap-2 rounded-[20px] bg-primary-tint px-4">
          <Text className="font-jakarta-bold text-xl text-primary">
            {order.fare != null ? formatCurrency(order.fare) : "—"}
          </Text>
          <Text className="flex-1 font-jakarta-medium text-xs text-muted-foreground">
            {order.payment === "cod"
              ? `COD — collect ${order.codAmount != null ? formatCurrency(order.codAmount) : "the order total"}`
              : "Prepaid"}
          </Text>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        {/* The offer lapses and moves to the next rider when this reaches 0 — it was counted but
            never shown, so the offer simply vanished from under a rider reading it. */}
        <Text
          className={`text-center font-jakarta-semibold text-sm ${secondsLeft <= 5 ? "text-destructive" : "text-muted-foreground"}`}
          accessibilityLiveRegion="polite"
        >
          {secondsLeft > 0 ? `Respond within ${secondsLeft}s` : "Offer expired"}
        </Text>

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
    </Screen>
  );
}
