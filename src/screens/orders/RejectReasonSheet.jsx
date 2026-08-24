import { useState } from "react";
import { Pressable, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import Text from "@/components/ui/Text";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { SKIP_REASONS } from "@/mocks/fixtures";
import client from "@/api/client";

// Presented as a transparentModal (see RootNavigator.jsx), matching
// FleetBadgeInfo's overlay pattern. Tapping a reason confirms immediately —
// the Figma design has no separate "Confirm" button, just the option rows.
// The one exception is "Other": the backend requires non-empty notes for that
// reason (server/controllers/partner/order.controller.js's rejectSchema), so it alone
// reveals a text field + explicit Confirm rather than submitting on tap.
export default function RejectReasonSheet() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const [selected, setSelected] = useState(null);
  const [otherNotes, setOtherNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submitReject(reason, notes) {
    setSubmitting(true);
    setError(null);
    try {
      await client.post(`/partner/orders/${params.orderId}/reject`, { reason, notes });
      navigation.navigate("OrdersSkipConfirmed");
    } catch (err) {
      if (err.code === "OFFER_EXPIRED" || err.code === "NOT_YOUR_OFFER") {
        navigation.navigate("HomeOffline");
      } else {
        setError(err.message);
        setSubmitting(false);
      }
    }
  }

  function handleSelect(reason) {
    if (submitting) return;
    setSelected(reason);
    if (reason !== "Other") submitReject(reason, undefined);
  }

  return (
    <View className="flex-1 justify-end bg-black/40">
      <Pressable className="flex-1" onPress={() => navigation.goBack()} />

      <View className="w-full gap-5 rounded-t-[20px] bg-card px-6 pb-10 pt-3 shadow-md shadow-black/20">
        <View className="w-full items-center">
          <View className="h-1 w-12 rounded-full bg-border-strong" />
        </View>

        <Text className="font-jakarta-bold text-xl text-foreground">Why are you skipping?</Text>

        <View className="w-full gap-2.5">
          {SKIP_REASONS.map((reason) => {
            const isSelected = reason === selected;
            return (
              <Pressable
                key={reason}
                onPress={() => handleSelect(reason)}
                className={cn(
                  "h-[52px] w-full items-start justify-center rounded-full border px-4",
                  isSelected ? "border-2 border-primary bg-primary-tint" : "border-border bg-white",
                )}
              >
                <Text
                  className={cn(
                    "text-sm",
                    isSelected ? "font-jakarta-semibold text-primary-hover" : "text-foreground",
                  )}
                >
                  {reason}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selected === "Other" && (
          <View className="w-full gap-3">
            <Input
              value={otherNotes}
              onChangeText={setOtherNotes}
              placeholder="Tell us more…"
              className="rounded-2xl"
            />
            {error && <Text className="text-center text-sm text-destructive">{error}</Text>}
            <Button
              disabled={submitting || !otherNotes.trim()}
              onPress={() => submitReject("Other", otherNotes.trim())}
            >
              {submitting ? "Submitting…" : "Confirm"}
            </Button>
          </View>
        )}

        {error && selected !== "Other" && (
          <Text className="text-center text-sm text-destructive">{error}</Text>
        )}
      </View>
    </View>
  );
}
