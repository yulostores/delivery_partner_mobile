import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Package } from "lucide-react-native";

import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import client from "@/api/client";

// The bottom-nav "Orders" tab's landing screen. Shows what is live for the rider — an offer
// waiting for an answer, or the delivery in progress — as a card they tap to open. It used to
// jump straight to that screen on every focus, which made the Orders button look dead from the
// offer screen (it bounced right back) and trapped Back: leaving a delivery screen returned here,
// and this screen sent the rider forward again.
export default function OrdersTab() {
  const navigation = useNavigation();
  const [status, setStatus] = useState("loading"); // "loading" | "empty" | "current" | "error"
  const [current, setCurrent] = useState(null); // { kind: "offer" | "assigned", order }

  const checkOrders = useCallback(
    (signal) => {
      setStatus("loading");
      client
        .get("/partner/orders/current")
        .then(({ kind, order }) => {
          if (signal.cancelled) return;
          if ((kind === "offer" || kind === "assigned") && order) {
            setCurrent({ kind, order });
            setStatus("current");
          } else {
            setCurrent(null);
            setStatus("empty");
          }
        })
        .catch(() => {
          if (!signal.cancelled) setStatus("error");
        });
    },
    [],
  );

  function openCurrent() {
    if (!current) return;
    const { kind, order } = current;
    if (kind === "offer") {
      navigation.navigate("OrdersIncoming", order);
    } else {
      // After pickup the rider belongs on the customer-facing leg, not back on pickup
      // (order.assignmentStatus — see yulo_backend's buildOfferPayload).
      navigation.navigate(order.assignmentStatus === "picked_up" ? "DeliveryNavigate" : "DeliveryPickup", {
        order,
      });
    }
  }

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

        {status === "current" && current && (
          <Pressable
            onPress={openCurrent}
            accessibilityRole="button"
            className="w-full gap-1 rounded-[20px] bg-card px-4 py-4 shadow-md shadow-black/10"
          >
            <Text className="font-jakarta-semibold text-xs text-primary">
              {current.kind === "offer"
                ? "New delivery request"
                : current.order.assignmentStatus === "picked_up"
                  ? "On the way to the customer"
                  : "Pick up from the restaurant"}
            </Text>
            <Text className="font-jakarta-bold text-base text-foreground">
              {current.order.restaurantName ?? "Your order"}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {current.kind === "offer" ? "Tap to accept or skip" : "Tap to continue the delivery"}
            </Text>
          </Pressable>
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
