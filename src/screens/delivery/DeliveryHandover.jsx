import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import OtpInput from "@/components/partner/OtpInput";
import client from "@/api/client";
import { isOrderGone, leaveGoneOrder } from "@/lib/orderGone";
import { deliveryCodeError } from "@/lib/deliveryCode";
import { goToTab } from "@/navigation/tabs";

// The doorstep handover for a prepaid order: the customer's app shows a 4-digit delivery code
// while the food is on its way, and the order is marked delivered only when the rider enters it
// (POST /partner/orders/:id/deliver { otp }). It replaces a "Handed the order over?" yes/no — a
// tap anyone could make without reaching the customer. A cash order asks for the same code on
// CodCollection.jsx. After too many wrong codes the server locks the order to Yulo support.
export default function DeliveryHandover() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const queryClient = useQueryClient();
  const order = params?.order;

  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  // Set once this rider delivered it themselves — the summary screen opens on top of this one,
  // and this screen must not then read the (now finished) order as "closed by support".
  const deliveredRef = useRef(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!order) goToTab("HomeOffline");
  }, [order, navigation]);

  // Yulo support can close this delivery for the rider (customer unreachable, or the rider locked
  // out after wrong codes — PATCH /admin/orders/:id/mark-delivered). Nothing is pushed to the rider
  // when that happens, so while this screen is open it checks whether the order is still theirs and
  // goes back to Home once it isn't — the rider used to be left on a screen with no way out.
  const { data: current } = useQuery({
    queryKey: ["partner", "orders", "current", "handover", order?.orderId],
    queryFn: () => client.get("/partner/orders/current"),
    enabled: Boolean(order) && isFocused && !submitting,
    refetchInterval: locked ? 5000 : 15000,
  });
  useEffect(() => {
    if (!order || !current || deliveredRef.current || !isFocused) return;
    const stillMine = current.kind === "assigned" && String(current.order?.orderId) === String(order.orderId);
    if (!stillMine) {
      queryClient.invalidateQueries({ queryKey: ["partner", "earnings"] });
      goToTab("HomeOffline", { notice: "Support closed this delivery — no further action needed.", noticeAt: Date.now() });
    }
  }, [current, order, queryClient, isFocused]);

  if (!order) return null;

  const canConfirm = otp.length === 4 && !submitting && !locked;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.post(`/partner/orders/${order.orderId}/deliver`, { otp });
      deliveredRef.current = true;
      // Same invalidation as CodCollection.jsx: Home's earnings queries would otherwise keep their
      // pre-delivery snapshot for up to a minute.
      queryClient.invalidateQueries({ queryKey: ["partner", "earnings"] });
      navigation.navigate("DeliverySummary", { order });
    } catch (err) {
      if (isOrderGone(err)) {
        leaveGoneOrder(err.code);
        return;
      }
      if (err.code === "DELIVERY_OTP_LOCKED") setLocked(true);
      setOtp("");
      setError(deliveryCodeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Hand over the order" />

      <View className="w-full gap-4 px-6 pt-5">
        <View className="w-full gap-1 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-sm text-foreground">
            {order.customerName ? `Delivering to ${order.customerName}` : "Delivering to the customer"}
          </Text>
          {order.customerAddress ? (
            <Text className="text-xs text-muted-foreground">{order.customerAddress}</Text>
          ) : null}
        </View>

        <View className="w-full gap-2 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-sm text-foreground">
            Customer's delivery code
          </Text>
          <Text className="text-xs text-muted-foreground">
            Hand over the food, then ask the customer for the 4-digit code shown in their Yulo app.
          </Text>
          <OtpInput
            length={4}
            value={otp}
            onChange={setOtp}
            boxHeight={48}
            className="justify-start"
            accessibilityLabel="Customer's delivery code"
          />
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        {locked ? (
          <Button onPress={() => navigation.navigate("ProfileHelpSupport")}>Contact support</Button>
        ) : (
          <Button variant={canConfirm ? "default" : "disabled"} disabled={!canConfirm} onPress={handleConfirm}>
            {submitting ? "Confirming…" : "Confirm delivery"}
          </Button>
        )}

        <Text className="text-center text-xs text-muted-foreground">
          Customer not answering or can't find the code? Call support from Profile → Help & support —
          they can close the delivery for you.
        </Text>
      </View>
    </Screen>
  );
}
