import { useEffect } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import client from "@/api/client";

export default function PaymentReceived() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const order = params?.order;

  useEffect(() => {
    if (!order) navigation.navigate("HomeOffline");
  }, [order, navigation]);

  // CodCollection.jsx already called POST .../deliver before navigating here, so the frozen
  // earningsBreakdown this reads already exists.
  const { data: summary, isError: summaryError } = useQuery({
    queryKey: ["partner", "orders", order?.orderId, "summary"],
    queryFn: () => client.get(`/partner/orders/${order.orderId}/summary`),
    enabled: !!order,
  });

  // Its own real figure (server/services/cashLedger.service.js's compute-on-read full ledger,
  // already reflecting this just-completed delivery's codCollected) — not hand-merged with
  // order.codAmount into a fabricated "before + this order" total.
  const { data: cashInHandData, isError: cashInHandError } = useQuery({
    queryKey: ["partner", "earnings", "cash-in-hand"],
    queryFn: () => client.get("/partner/earnings/cash-in-hand"),
    enabled: !!order,
  });

  if (!order) return null;

  const payout = summary?.payout;
  const tripEarning = payout
    ? payout.basePay + payout.distancePay + payout.surge + payout.tip - payout.penalty
    : null;
  const cashInHand = cashInHandData?.cashInHand;

  const rows = [
    { label: "Order amount", value: `₹${order.codAmount.toFixed(2)}` },
    { label: "Paid via", value: "Cash" },
    { label: "Change returned", value: "—" },
    {
      label: "Your trip earning",
      value: tripEarning != null ? `₹${tripEarning.toFixed(2)}` : summaryError ? "Unavailable" : "…",
      accent: true,
    },
    { label: "Deposit due", value: `₹${order.codAmount.toFixed(2)}` },
  ];

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="h-[200px] w-full items-center gap-5 bg-success px-6 pb-6 pt-[26px]">
        <View className="size-16 items-center justify-center rounded-full bg-white">
          <Check size={28} color="#22a853" strokeWidth={3} />
        </View>
        <View className="items-center gap-0.5">
          <Text className="font-jakarta-bold text-2xl text-white">Payment received</Text>
          <Text className="text-sm text-white">
            ₹{order.codAmount.toFixed(2)} collected · {order.restaurantName}
          </Text>
        </View>
      </View>

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        <View className="w-full gap-3.5 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-base text-foreground">
            Collection summary
          </Text>
          <View className="gap-3.5">
            {rows.map((row) => (
              <View key={row.label} className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{row.label}</Text>
                <Text
                  className={
                    row.accent
                      ? "font-jakarta-semibold text-sm text-success"
                      : "text-sm text-foreground"
                  }
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <View className="h-px w-full bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-bold text-base text-foreground">Cash in hand now</Text>
            <Text className="font-jakarta-bold text-xl text-primary">
              {cashInHand != null ? `₹${cashInHand.toFixed(2)}` : cashInHandError ? "Unavailable" : "…"}
            </Text>
          </View>
        </View>

        <View className="w-full items-center rounded-full border border-[#e53e3e] bg-[#fce8e8] p-4 shadow-md shadow-black/10">
          <Text className="text-center font-jakarta-semibold text-sm text-[#e53e3e]">
            {cashInHand != null
              ? `Cash in hand: ₹${cashInHand.toFixed(2)} · Deposit now →`
              : cashInHandError
                ? "Couldn't load cash in hand — check the Earnings tab"
                : "Loading cash in hand…"}
          </Text>
        </View>

        <Button onPress={() => navigation.navigate("HomeOffline")}>Done — next order</Button>
      </View>

      <BottomNav />
    </Screen>
  );
}
