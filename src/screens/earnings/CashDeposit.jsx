import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { formatCurrency } from "@/lib/format";
import client from "@/api/client";

export default function CashDeposit() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Same query (and cache entry) Earnings.jsx reads — single source of truth, resolving the
  // exact inconsistency this screen's own AMOUNT_TO_DEPOSIT comment used to flag.
  const { data: cashInHandData } = useQuery({
    queryKey: ["partner", "earnings", "cash-in-hand"],
    queryFn: () => client.get("/partner/earnings/cash-in-hand"),
  });
  const cashInHand = cashInHandData?.cashInHand;

  // Both "Deposit cash" (primary) and "I've deposited at store" (secondary) are real completion
  // paths in the updated design — no QR/maps affordance exists here anymore — so both submit the
  // same deposit. No partial-deposit UI exists here, so this always deposits the full current
  // balance (the backend's own API supports a partial amount, this screen just never exposes it).
  async function handleDeposited() {
    if (!cashInHand || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { deposit, cashInHand: cashInHandAfter } = await client.post("/partner/deposits", {
        amount: cashInHand,
      });
      queryClient.invalidateQueries({ queryKey: ["partner", "earnings", "cash-in-hand"] });
      navigation.navigate("EarningsDepositConfirmed", { deposit, cashInHandAfter });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Deposit cash" onBack />

      <View className="w-full gap-4 px-6 pt-5">
        <View className="w-full gap-2 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-medium text-xs text-muted-foreground">
            Cash in hand to deposit
          </Text>
          <Text className="font-jakarta-bold text-[36px] leading-[45px] text-foreground">
            {cashInHand != null ? formatCurrency(cashInHand) : "…"}
          </Text>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Button disabled={!cashInHand || submitting} onPress={handleDeposited}>
          {submitting ? "Depositing…" : "Deposit cash"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!cashInHand || submitting}
          onPress={handleDeposited}
        >
          I&rsquo;ve deposited at store
        </Button>
      </View>
    </Screen>
  );
}
