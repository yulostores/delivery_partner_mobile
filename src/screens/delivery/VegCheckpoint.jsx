import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Check } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import OtpInput from "@/components/partner/OtpInput";
import { cn } from "@/lib/utils";
import client from "@/api/client";

// Matches server/controllers/partner/order.controller.js's packagingChecklist fields exactly
// (sealIntact, tempBagUsed). The old second item, "No other order in bag", didn't correspond to
// either backend field — tempBagUsed means a certified insulated bag was used (see
// IncomingOrder.jsx's "use your certified bag" copy for veg orders), a different fact entirely.
// Relabeled so the checkbox the partner taps actually matches what gets sent.
const CHECKLIST_ITEMS = [
  { key: "sealIntact", label: "Sealed veg packaging verified" },
  { key: "tempBagUsed", label: "Used certified insulated bag" },
];

// Reached from GoToPickup once the partner arrives at the restaurant. Renders
// two Figma frames from one component, same pattern as IncomingOrder.jsx's
// veg/standard split: "14 – Veg Checkpoint" adds a packaging-verification
// checklist between the order items and the OTP entry; "14 – Regular order
// Checkpoint" goes straight from items to OTP. Both are driven by
// `order.fleetType`, so GoToPickup can route here for either fleet without
// needing a second registered route — see the routing note in GoToPickup.jsx.
export default function VegCheckpoint() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const order = params?.order;
  const isVeg = order?.fleetType === "veg";

  const [checklist, setChecklist] = useState({ sealIntact: true, tempBagUsed: false });
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!order) navigation.navigate("HomeOffline");
  }, [order, navigation]);

  if (!order) return null;

  const allChecked = Object.values(checklist).every(Boolean);
  const checklistPending = isVeg && !allChecked;
  const canConfirm = !checklistPending && otp.length === 4 && !submitting;

  function toggleChecklist(key) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.post(`/partner/orders/${order.orderId}/verify-pickup`, {
        otp,
        // Only sent for veg orders — the backend only requires it then (per req.partner.fleetType),
        // and sending it harmlessly for standard orders is fine too, but there's nothing to send
        // if the checklist was never shown.
        ...(isVeg ? { packagingChecklist: checklist } : {}),
      });
      navigation.navigate("DeliveryNavigate", { order });
    } catch (err) {
      if (err.code === "INVALID_OTP") {
        setError("Incorrect pickup OTP — check the code and try again.");
      } else if (err.code === "CHECKLIST_INCOMPLETE") {
        setError("Complete the veg packaging checklist before confirming pickup.");
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="At restaurant" />

      <View className="w-full gap-4 px-6 pt-5">
        <View className="w-full gap-3.5 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-sm text-foreground">Order items</Text>
          {order.items.map((item) => (
            <Text key={item.name} className="w-full text-sm text-foreground">
              {item.name} × {item.qty}
            </Text>
          ))}
        </View>

        {isVeg && (
          <View className="w-full gap-4 rounded-[20px] border-[1.5px] border-success bg-success-tint p-4 shadow-md shadow-black/10">
            <Text className="font-jakarta-bold text-base text-[#17803d]">Veg pickup checklist</Text>
            <View className="w-full gap-6">
              {CHECKLIST_ITEMS.map(({ key, label }) => {
                const checked = checklist[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleChecklist(key)}
                    className="w-full flex-row items-center gap-3"
                  >
                    <View
                      className={cn(
                        "size-7 items-center justify-center rounded-lg",
                        checked ? "bg-success" : "border-2 border-border-strong bg-white",
                      )}
                    >
                      {checked && <Check size={16} color="#ffffff" strokeWidth={3} />}
                    </View>
                    <Text className="flex-1 font-jakarta-medium text-sm text-foreground">
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View className="w-full gap-2 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-sm text-foreground">Enter pickup OTP</Text>
          <OtpInput
            length={4}
            value={otp}
            onChange={setOtp}
            boxHeight={48}
            className="justify-start"
            accessibilityLabel="Pickup OTP"
          />
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Button variant={canConfirm ? "default" : "disabled"} disabled={!canConfirm} onPress={handleConfirm}>
          {submitting
            ? "Verifying…"
            : checklistPending
              ? "Confirm pickup — complete checklist first"
              : "Confirm pickup"}
        </Button>
      </View>
    </Screen>
  );
}
