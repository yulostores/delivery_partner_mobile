import { useEffect, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import client from "@/api/client";
import { formatCurrency } from "@/lib/format";
import { isOrderGone, leaveGoneOrder } from "@/lib/orderGone";
import { goToTab } from "@/navigation/tabs";

// The server's limit on a reported collection (deliverSchema in
// server/controllers/partner/order.controller.js): at most ₹1,00,000, to the paisa.
const MAX_COD_COLLECTED = 100000;

// The amount to report, or why it can't be. Rounded to the paisa (the server rejects more
// decimals) and never above the server's cap.
function codCollectedFor(codAmount) {
  const amount = Math.round(Number(codAmount) * 100) / 100;
  if (codAmount == null || !Number.isFinite(amount) || amount < 0) {
    return { error: "This order has no cash amount to collect — contact support." };
  }
  if (amount > MAX_COD_COLLECTED) {
    return { error: "This order is above the ₹1,00,000 cash limit — contact support before delivering." };
  }
  return { amount };
}

export default function CodCollection() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const queryClient = useQueryClient();
  const order = params?.order;
  const [cashReceived, setCashReceived] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!order) goToTab("HomeOffline");
  }, [order, navigation]);

  if (!order) return null;

  async function handleConfirmDelivery() {
    if (!cashReceived || submitting) return;
    const { amount, error: amountError } = codCollectedFor(order.codAmount);
    if (amountError) {
      setError(amountError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // The "Mark cash received" toggle above is the only input here by design — the backend
      // deliberately doesn't hard-validate the collected amount against order.codAmount (see
      // deliverOrder's codDiscrepancy comment), so this always reports the known order amount
      // rather than a separately-typed figure the partner could get wrong by typo.
      await client.post(`/partner/orders/${order.orderId}/deliver`, { codCollected: amount });
      // Home.jsx's earnings/cash-in-hand queries fetch once (before this delivery even happened)
      // and sit on a 60s staleTime — without this, Earnings.jsx and PaymentReceived.jsx (which
      // share those exact query keys) would keep painting that stale pre-delivery snapshot instead
      // of this order's real payout for up to a minute.
      queryClient.invalidateQueries({ queryKey: ["partner", "earnings"] });
      navigation.navigate("DeliveryPaymentReceived", { order });
    } catch (err) {
      if (isOrderGone(err)) leaveGoneOrder(err.code);
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Collect payment" />

      <View className="w-full gap-4 px-6 pt-5">
        <View className="w-full gap-2 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-medium text-xs text-muted-foreground">
            Amount to collect (COD)
          </Text>
          <Text className="font-jakarta-bold text-[36px] leading-[45px] text-foreground">
            {order.codAmount != null ? formatCurrency(order.codAmount) : "—"}
          </Text>
        </View>

        {/* No UPI QR here: the backend has no way to generate one for an order or to confirm a
            UPI payment to it, and a placeholder box told riders to "scan to pay" at nothing. */}
        <Button
          variant={cashReceived ? "default" : "secondary"}
          size="sm"
          onPress={() => setCashReceived((v) => !v)}
        >
          {cashReceived ? "Cash received ✓" : "Mark cash received"}
        </Button>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Button
          variant={cashReceived ? "default" : "disabled"}
          disabled={!cashReceived || submitting}
          onPress={handleConfirmDelivery}
        >
          {submitting ? "Confirming…" : "Confirm delivery"}
        </Button>
      </View>
    </Screen>
  );
}
