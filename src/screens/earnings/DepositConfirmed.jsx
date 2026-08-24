import { useEffect } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Check } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default function DepositConfirmed() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const deposit = params?.deposit;
  const cashInHandAfter = params?.cashInHandAfter;

  useEffect(() => {
    if (!deposit) navigation.navigate("HomeOffline");
  }, [deposit, navigation]);

  if (!deposit) return null;

  // No restaurant-picker exists on CashDeposit.jsx, so depositPointRestaurantId is never sent —
  // a generic "Deposited" is honest here; fabricating a specific restaurant name the backend
  // never received would just be a different flavor of the same mock-data problem this step
  // fixes elsewhere (depositPointRestaurantId is optional on the backend for exactly this reason).
  const ROWS = [
    { label: "Amount deposited", value: formatCurrency(deposit.amount) },
    { label: "Method", value: "Store deposit" },
    { label: "Deposit point", value: "Deposited" },
    { label: "Date & time", value: formatDateTime(deposit.createdAt) },
  ];

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="h-[200px] w-full items-center gap-5 bg-success px-6 pb-6 pt-[26px]">
        <View className="size-16 items-center justify-center rounded-full bg-white">
          <Check size={28} color="#22a853" strokeWidth={3} />
        </View>
        <View className="items-center gap-0.5">
          <Text className="font-jakarta-bold text-2xl text-white">Cash deposited</Text>
          <Text className="text-sm text-white">
            {formatCurrency(deposit.amount)} · Deposited at store
          </Text>
        </View>
      </View>

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        <View className="w-full gap-3.5 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-base text-foreground">Deposit summary</Text>
          <View className="gap-3.5">
            {ROWS.map((row) => (
              <View key={row.label} className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{row.label}</Text>
                <Text className="text-sm text-foreground">{row.value}</Text>
              </View>
            ))}
          </View>
          <View className="h-px w-full bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-bold text-base text-foreground">Cash in hand now</Text>
            <Text className="font-jakarta-bold text-xl text-primary">
              {formatCurrency(cashInHandAfter ?? 0)}
            </Text>
          </View>
        </View>

        <Button onPress={() => navigation.navigate("HomeOffline")}>Done</Button>
      </View>

      <BottomNav />
    </Screen>
  );
}
