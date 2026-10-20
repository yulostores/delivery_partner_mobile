import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import BottomNav from "@/components/partner/BottomNav";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { usePartnerConfig } from "@/lib/partnerConfig";
import client from "@/api/client";
import { usePartnerAuth } from "@/context/PartnerAuthContext";

const TABS = [
  { key: "today", label: "Today" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

// Every figure is the server's (GET /partner/earnings — the sum of each delivery's breakdown,
// frozen when the rider accepted it): base pay for the first km, distance pay beyond them, and
// the customer's tip, which is 100% the rider's. Nothing is added up here.
const money = (n) => formatCurrency(Number(n) || 0);
const BREAKDOWN_ROWS = (data, isVeg) =>
  [
    { label: "Base pay", value: data.basePay },
    { label: "Distance pay", value: data.distancePay },
    Number(data.peakSurge) > 0 && { label: "Peak surge", value: data.peakSurge },
    { label: "Tips", value: data.tips },
    isVeg && { label: "Veg fleet idle-pay", value: data.idlePay },
    { label: "Penalties", value: -(Number(data.penalties) || 0), isPenalty: true },
  ].filter(Boolean);

const deliveryTime = (at) =>
  at
    ? new Date(at).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

// One delivery's line: what it paid, as the server froze it (legacy flat-rate deliveries carry
// their own breakdown too, so they read the same way).
function DeliveryLine({ d }) {
  const parts = [
    `Base ${money(d.basePay)}`,
    Number(d.distancePay) > 0 && `Distance ${money(d.distancePay)}`,
    Number(d.surgePay) > 0 && `Surge ${money(d.surgePay)}`,
    Number(d.tip) > 0 && `Tip ${money(d.tip)}`,
    Number(d.penalty) > 0 && `Penalty −${money(d.penalty)}`,
  ].filter(Boolean);
  const meta = [deliveryTime(d.deliveredAt), d.distanceKm != null ? `${d.distanceKm} km` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <View className="w-full flex-row items-start justify-between gap-3 py-2.5">
      <View className="flex-1 gap-0.5">
        <Text className="font-jakarta-semibold text-sm text-foreground">
          {d.restaurantName ?? "Delivery"}
        </Text>
        {meta ? <Text className="text-xs text-muted-foreground">{meta}</Text> : null}
        <Text className="text-xs text-muted-foreground">{parts.join(" · ")}</Text>
      </View>
      <Text className="font-jakarta-bold text-sm text-foreground">{money(d.total)}</Text>
    </View>
  );
}

export default function Earnings() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { user } = usePartnerAuth();
  const [period, setPeriod] = useState(params?.period ?? "today");
  const isVeg = user?.fleetType === "veg";
  const { codEnabled } = usePartnerConfig();

  const {
    data,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["partner", "earnings", period],
    queryFn: () => client.get(`/partner/earnings?period=${period}`),
  });
  // Two separate real endpoints on purpose (see cashLedger.service.js's full-ledger design
  // comment) — not derived from `data` above, which only covers the selected period's earnings.
  // Cash in hand only exists for cash-on-delivery orders — not fetched or shown while COD is off.
  const { data: cashInHandData } = useQuery({
    queryKey: ["partner", "earnings", "cash-in-hand"],
    queryFn: () => client.get("/partner/earnings/cash-in-hand"),
    enabled: codEnabled,
  });
  const cashInHand = cashInHandData?.cashInHand;

  // A bare `if (!data) return null` here would leave a permanently-failing fetch as a blank
  // screen forever (no AppBar, no BottomNav, no way back) — show a retry instead.
  if (isError) {
    return (
      <Screen edges={["top", "bottom"]}>
        <AppBar title="Earnings" />
        <View className="w-full flex-1 items-center justify-center px-6">
          <Pressable onPress={() => refetch()}>
            <Text className="text-center text-sm text-destructive">
              Couldn&rsquo;t load earnings — tap to retry
            </Text>
          </Pressable>
        </View>
        <BottomNav />
      </Screen>
    );
  }
  if (!data) return null;

  return (
    <Screen edges={["top", "bottom"]}>
      <AppBar title="Earnings" />

      <ScrollView className="w-full flex-1" contentContainerClassName="gap-4 px-6 pb-6 pt-3">
        <View className="w-full flex-row rounded-full bg-muted p-1">
          {TABS.map((tab) => {
            const active = tab.key === period;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setPeriod(tab.key)}
                className={cn(
                  "h-9 flex-1 items-center justify-center rounded-full",
                  active && "bg-primary",
                )}
              >
                <Text
                  className={cn(
                    "text-sm",
                    active ? "font-jakarta-semibold text-white" : "font-jakarta-medium text-muted-foreground",
                  )}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="w-full gap-1.5 rounded-[20px] bg-primary p-4 shadow-md shadow-primary/40">
          <Text className="font-jakarta-medium text-xs text-white">
            Total earned {data.label}
          </Text>
          <Text className="font-jakarta-bold text-[36px] leading-[45px] text-white">
            {money(data.totalEarned)}
          </Text>
          <Text className="text-xs text-white">
            {data.orders} {data.orders === 1 ? "delivery" : "deliveries"} · tips {money(data.tips)} included
          </Text>
        </View>

        <View className="w-full gap-3 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-bold text-base text-foreground">Breakdown</Text>
          <View className="gap-3">
            {BREAKDOWN_ROWS(data, isVeg).map((row) => (
              <View key={row.label} className="w-full flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{row.label}</Text>
                <Text className="font-jakarta-medium text-sm text-foreground">
                  {row.isPenalty
                    ? row.value < 0
                      ? `−${money(Math.abs(row.value))}`
                      : "—"
                    : money(row.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="w-full gap-1 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-bold text-base text-foreground">Deliveries</Text>
          {data.deliveries?.length ? (
            data.deliveries.map((d, i) => (
              <View key={String(d.orderId)}>
                {i > 0 && <View className="h-px w-full bg-border" />}
                <DeliveryLine d={d} />
              </View>
            ))
          ) : (
            <Text className="py-2 text-sm text-muted-foreground">
              No deliveries {data.label ?? "in this period"}.
            </Text>
          )}
        </View>

        {codEnabled && (
          <Pressable
            onPress={() => navigation.navigate("EarningsCashDeposit")}
            className="w-full flex-row items-center rounded-[20px] border border-destructive bg-destructive/10 p-4 shadow-md shadow-black/10"
          >
            <Text className="flex-1 font-jakarta-semibold text-sm text-destructive">
              Cash in hand: {cashInHand != null ? money(cashInHand) : "…"} · Deposit now →
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <BottomNav />
    </Screen>
  );
}
