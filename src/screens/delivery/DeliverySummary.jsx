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

export default function DeliverySummary() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const order = params?.order;

  useEffect(() => {
    if (!order) navigation.navigate("HomeOffline");
  }, [order, navigation]);

  // NavigateToCustomer.jsx already called POST .../deliver (no body — prepaid, nothing to
  // collect) before navigating here, so the frozen earningsBreakdown this reads already exists.
  const { data: summary, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ["partner", "orders", order?.orderId, "summary"],
    queryFn: () => client.get(`/partner/orders/${order.orderId}/summary`),
    enabled: !!order,
  });

  if (!order) return null;

  const payout = summary?.payout;
  const total = payout
    ? payout.basePay + payout.distancePay + payout.surge + payout.tip - payout.penalty
    : null;
  const totalKm = summary?.totalKm;

  const rows = payout
    ? [
        { label: "Base pay", value: `₹${payout.basePay.toFixed(2)}` },
        {
          label: `Distance${totalKm != null ? ` (${totalKm} km)` : ""}`,
          value: `₹${payout.distancePay.toFixed(2)}`,
        },
        { label: "Peak surge", value: `₹${payout.surge.toFixed(2)}` },
        { label: "Tip", value: `₹${payout.tip.toFixed(2)}`, accent: true },
        { label: "Penalty", value: payout.penalty > 0 ? `-₹${payout.penalty.toFixed(2)}` : "—" },
      ]
    : [];

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="h-[200px] w-full items-center gap-5 bg-success px-6 pb-6 pt-[26px]">
        <View className="size-16 items-center justify-center rounded-full bg-white">
          <Check size={28} color="#22a853" strokeWidth={3} />
        </View>
        <View className="items-center gap-0.5">
          <Text className="font-jakarta-bold text-2xl text-white">Delivered!</Text>
          <Text className="text-sm text-white">{order.restaurantName}</Text>
        </View>
      </View>

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        <View className="w-full gap-3.5 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-base text-foreground">Order payout</Text>
          {payout ? (
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
          ) : summaryError ? (
            <Text className="text-sm text-destructive" onPress={() => refetchSummary()}>
              Couldn&rsquo;t load payout — tap to retry
            </Text>
          ) : (
            <Text className="text-sm text-muted-foreground">Loading payout…</Text>
          )}
          <View className="h-px w-full bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-bold text-base text-foreground">Total earned</Text>
            <Text className="font-jakarta-bold text-xl text-primary">
              {total != null ? `₹${total.toFixed(2)}` : summaryError ? "Unavailable" : "…"}
            </Text>
          </View>
        </View>

        <Button onPress={() => navigation.navigate("HomeOffline")}>Done — next order</Button>
      </View>

      <BottomNav />
    </Screen>
  );
}
