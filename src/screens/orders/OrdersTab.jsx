import { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Package } from "lucide-react-native";

import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import client from "@/api/client";

// The bottom-nav "Orders" tab's landing screen. Distinct from IncomingOrder.jsx, which only
// renders once it's handed a real offer/assigned order via route params (pushed by the
// order_offer socket event, or forwarded from here on a GET /partner/orders/current hit) — this
// screen owns the "tapped the tab with nothing pending" case that used to silently bounce
// straight back to Home.
export default function OrdersTab() {
  const navigation = useNavigation();
  const [status, setStatus] = useState("loading"); // "loading" | "empty" | "error"

  const checkOrders = useCallback(
    (signal) => {
      setStatus("loading");
      client
        .get("/partner/orders/current")
        .then(({ kind, order }) => {
          if (signal.cancelled) return;
          if (kind === "offer") {
            navigation.navigate("OrdersIncoming", order);
          } else if (kind === "assigned") {
            navigation.navigate("DeliveryPickup", { order });
          } else {
            setStatus("empty");
          }
        })
        .catch(() => {
          if (!signal.cancelled) setStatus("error");
        });
    },
    [navigation],
  );

  // Re-checks every time the tab is focused (not just on first mount) — a partner bouncing
  // between tabs while an offer lands should see it the next time they tap back in, not just on
  // the very first visit.
  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      checkOrders(signal);
      return () => {
        signal.cancelled = true;
      };
    }, [checkOrders]),
  );

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="h-16 w-full flex-row items-center bg-card pl-6">
        <Text className="font-jakarta-semibold text-[16px] text-foreground">Orders</Text>
      </View>

      <View className="w-full flex-1 items-center justify-center gap-2 px-10">
        {status === "loading" && (
          <Text className="text-center text-sm text-muted-foreground">Checking for orders…</Text>
        )}

        {status === "empty" && (
          <>
            <View className="mb-1 size-14 items-center justify-center rounded-full bg-muted">
              <Package size={26} color="#999999" />
            </View>
            <Text className="text-center font-jakarta-semibold text-base text-foreground">
              You don&rsquo;t have any orders
            </Text>
            <Text className="text-center text-sm text-muted-foreground">
              Go online from Home and we&rsquo;ll notify you as soon as a new order comes in.
            </Text>
          </>
        )}

        {status === "error" && (
          <Text
            className="text-center text-sm text-destructive"
            onPress={() => checkOrders({ cancelled: false })}
          >
            Couldn&rsquo;t load your orders — tap to retry
          </Text>
        )}
      </View>

      <BottomNav />
    </Screen>
  );
}
