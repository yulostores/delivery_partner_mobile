import { useEffect, useState } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import client from "@/api/client";

export default function CodCollection() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const queryClient = useQueryClient();
  const order = params?.order;
  const [cashReceived, setCashReceived] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!order) navigation.navigate("HomeOffline");
  }, [order, navigation]);

  if (!order) return null;

  async function handleConfirmDelivery() {
    if (!cashReceived || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // The "Mark cash received" toggle above is the only input here by design — the backend
      // deliberately doesn't hard-validate the collected amount against order.codAmount (see
      // deliverOrder's codDiscrepancy comment), so this always reports the known order amount
      // rather than a separately-typed figure the partner could get wrong by typo.
      await client.post(`/partner/orders/${order.orderId}/deliver`, { codCollected: order.codAmount });
      // Home.jsx's earnings/cash-in-hand queries fetch once (before this delivery even happened)
      // and sit on a 60s staleTime — without this, Earnings.jsx and PaymentReceived.jsx (which
      // share those exact query keys) would keep painting that stale pre-delivery snapshot instead
      // of this order's real payout for up to a minute.
      queryClient.invalidateQueries({ queryKey: ["partner", "earnings"] });
      navigation.navigate("DeliveryPaymentReceived", { order });
    } catch (err) {
      setError(err.message);
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
            ₹{order.codAmount.toFixed(2)}
          </Text>
        </View>

        <View className="w-full items-center gap-2 rounded-[20px] bg-card px-4 pb-9 pt-2 shadow-md shadow-black/10">
          <Text className="py-1.5 text-center text-sm text-muted-foreground">
            Scan to pay via UPI
          </Text>
          <View className="size-[148px] items-center justify-center rounded-xl bg-muted">
            <Text className="text-sm text-muted-foreground">QR Code</Text>
          </View>
        </View>

        <View className="w-full flex-row items-center gap-3 py-1.5">
          <View className="h-px flex-1 bg-border" />
          <Text className="text-sm text-muted-foreground">or</Text>
          <View className="h-px flex-1 bg-border" />
        </View>

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
