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
import { formatCurrency } from "@/lib/format";

// The trip's earning: the server's own total (GET …/summary — base + distance pay + surge +
// tip − penalty). An older backend without `total` falls back to the same sum of its parts.
const part = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const tripEarningOf = (p) => {
  if (!p) return null;
  if (Number.isFinite(Number(p.total))) return Number(p.total);
  return Math.round((part(p.basePay) + part(p.distancePay) + part(p.surge) + part(p.tip) - part(p.penalty)) * 100) / 100;
};

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
  const total = tripEarningOf(payout);
  const totalKm = summary?.totalKm;

  const rows = payout
    ? [
        { label: "Base pay", value: formatCurrency(part(payout.basePay)) },
        {
          label: `Distance pay${totalKm != null ? ` (${totalKm} km)` : ""}`,
          value: formatCurrency(part(payout.distancePay)),
        },
        part(payout.surge) > 0 && { label: "Peak surge", value: formatCurrency(part(payout.surge)) },
        { label: "Tip (100% yours)", value: formatCurrency(part(payout.tip)), accent: true },
        part(payout.penalty) > 0 && { label: "Penalty", value: `−${formatCurrency(part(payout.penalty))}` },
      ].filter(Boolean)
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
              {total != null ? formatCurrency(total) : summaryError ? "Unavailable" : "…"}
            </Text>
          </View>
        </View>

        <Button onPress={() => navigation.navigate("HomeOffline")}>Done — next order</Button>
      </View>

      <BottomNav />
    </Screen>
  );
}
