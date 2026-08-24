import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import { formatClock } from "@/lib/format";
import client from "@/api/client";
import { connectPartnerSocket, disconnectPartnerSocket } from "@/lib/partnerSocket";
import { startLocationPings, stopLocationPings } from "@/lib/locationPings";

// The bonus/incentive-target card below (🎯 "N more orders before 3 PM → ₹X bonus") has no
// backend concept behind it anywhere in this codebase — no incentive-program endpoint, no target
// field on DeliveryPartner or Order. Left as static UI rather than either fabricating an API for
// it or silently dropping working UI; matches how SupportHelp.jsx's call/chat/email rows stay
// honest no-ops for the same reason (confirmed, no realistic backend to wire to).
const BONUS_MOCK = { bonusTarget: 3, bonusAmount: 120, bonusProgressPct: 40 };

// 'busy' (mid-delivery) counts as on-duty for display purposes even though the toggle can't
// flip it off directly (the backend 409s — see handleToggleOnline).
const ON_DUTY_STATUSES = new Set(["active", "busy"]);

function DemandHeatmap() {
  return (
    <View className="h-[300px] w-full overflow-hidden bg-success-tint px-4 pt-2">
      <View className="h-7 w-[168px] items-center justify-center rounded-full bg-success-tint">
        <Text className="font-jakarta-semibold text-xs text-[#17803d]">Veg demand heatmap</Text>
      </View>
      <View
        className="absolute rounded-full bg-success/20"
        style={{ left: 15, top: 165, width: 110, height: 110 }}
      />
      <View
        className="absolute rounded-full bg-success/25"
        style={{ left: 135, top: 175, width: 150, height: 150 }}
      />
      <View
        className="absolute rounded-full bg-success/20"
        style={{ left: 275, top: 140, width: 90, height: 90 }}
      />
    </View>
  );
}

export default function Home() {
  const navigation = useNavigation();

  // null = not hydrated yet from the backend's real duty status; deliberately not defaulting to
  // false/offline, since a partner who force-quit the app while online should reopen it and see
  // themselves still online.
  const [isOnline, setIsOnline] = useState(null);
  const [hydrateError, setHydrateError] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState(null);
  const [dutySeconds, setDutySeconds] = useState(0);
  const intervalRef = useRef(null);
  const isOnlineRef = useRef(false);

  useEffect(() => {
    isOnlineRef.current = isOnline === true;
  }, [isOnline]);

  const startClock = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setDutySeconds((s) => s + 1), 1000);
  }, []);

  const stopClock = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setDutySeconds(0);
  }, []);

  // Resumes into whatever's actually in flight per the backend — an offer still waiting on an
  // answer, or an order already accepted — rather than stranding the partner on Home after the
  // app was backgrounded mid-offer or mid-delivery. Best-effort: a failure here just leaves the
  // partner on Home, which is always a safe fallback.
  const checkCurrentOrder = useCallback(async () => {
    try {
      const { kind, order } = await client.get("/partner/orders/current");
      if (kind === "offer") {
        navigation.navigate("OrdersIncoming", order);
      } else if (kind === "assigned") {
        navigation.navigate("DeliveryPickup", { order });
      }
    } catch {
      // best-effort — see comment above
    }
  }, [navigation]);

  const fetchDutyStatus = useCallback(async () => {
    setHydrateError(false);
    try {
      const { status } = await client.get("/partner/duty/status");
      const online = ON_DUTY_STATUSES.has(status);
      setIsOnline(online);
      if (online) {
        startClock();
        // The backend's live:active_partners presence set depends on an actual live socket
        // connection, not just this status field — a partner can be 'active' in the DB while
        // completely unreachable if the app was killed and relaunched. Reconnect here so a
        // partner who force-quit while online is actually rejoined, not just shown as online.
        connectPartnerSocket();
        checkCurrentOrder();
        startLocationPings();
      }
    } catch {
      setHydrateError(true);
      setIsOnline(false);
    }
  }, [startClock, checkCurrentOrder]);

  useEffect(() => {
    fetchDutyStatus();
    return () => clearInterval(intervalRef.current);
  }, [fetchDutyStatus]);

  // App backgrounding doesn't unmount this screen (no fresh mount-effect fires), so a socket
  // dropped by the OS while suspended needs an explicit nudge on return to foreground rather
  // than waiting on socket.io's own reconnect/ping-timeout detection. Same reasoning applies to
  // resuming into a live offer/delivery — the socket push that would've delivered a fresh offer
  // couldn't reach a suspended app either.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && isOnlineRef.current) {
        connectPartnerSocket();
        checkCurrentOrder();
        startLocationPings();
      }
    });
    return () => subscription.remove();
  }, [checkCurrentOrder]);

  async function handleToggleOnline() {
    if (isOnline === null || toggling) return;
    const nextOnline = !isOnline;
    setToggling(true);
    setToggleError(null);
    try {
      await client.post("/partner/duty/toggle", { online: nextOnline });
      setIsOnline(nextOnline);
      if (nextOnline) {
        startClock();
        connectPartnerSocket();
        startLocationPings();
      } else {
        stopClock();
        disconnectPartnerSocket();
        stopLocationPings();
      }
    } catch (err) {
      if (err.code === "NOT_VERIFIED") {
        setToggleError("Complete verification before going online.");
      } else if (err.code === "PARTNER_BUSY") {
        setToggleError("Can't change duty status while on an active delivery.");
      } else {
        setToggleError(err.message);
      }
      // Deliberately not flipping isOnline before the request succeeds — the UI must reflect
      // the backend's actual state, not an optimistic guess that might get rejected.
    } finally {
      setToggling(false);
    }
  }

  const online = isOnline === true;

  // Same query keys Earnings.jsx/CashDeposit.jsx/PaymentReceived.jsx already use — shares their
  // cache rather than fetching separately. Only meaningful while online (matches what's actually
  // rendered below), so gated to avoid a pointless fetch while offline.
  const { data: profileData } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const {
    data: earningsData,
    isError: earningsError,
    refetch: refetchEarnings,
  } = useQuery({
    queryKey: ["partner", "earnings", "today"],
    queryFn: () => client.get("/partner/earnings?period=today"),
    enabled: online,
  });
  const { data: cashInHandData } = useQuery({
    queryKey: ["partner", "earnings", "cash-in-hand"],
    queryFn: () => client.get("/partner/earnings/cash-in-hand"),
    enabled: online,
  });
  const fleetType = profileData?.partner?.fleetType;
  const fleetLabel = fleetType === "veg" ? "Veg-Only Fleet" : "Standard Fleet";
  // Sourced from this same profile fetch, not usePartnerAuth()'s `user` — that's only ever set
  // once at login (verifyOtp()) and never refreshed, so it still held the pre-onboarding blank
  // name for the rest of the session even after PersonalInformation.jsx saved the real name.
  const firstName = profileData?.partner?.fullName?.split(" ")[0];

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="h-16 w-full flex-row items-center justify-between bg-card pl-6 pr-5">
        <Text className="font-jakarta-semibold text-[16px] text-foreground">
          Good morning{firstName ? `, ${firstName}` : ""}
        </Text>
        {!online && (
          <Pressable
            onPress={() => navigation.navigate("FleetBadgeInfo", { fleetType })}
            className="h-7 items-center justify-center rounded-full bg-success-tint px-3"
          >
            <Text className="font-jakarta-semibold text-xs text-[#17803d]">{fleetLabel}</Text>
          </Pressable>
        )}
      </View>

      {online ? (
        <DemandHeatmap />
      ) : (
        <View className="h-[328px] w-full items-center justify-center bg-muted px-6">
          <Text className="text-center text-sm text-muted-foreground">
            Go online to see demand heatmap
          </Text>
        </View>
      )}

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        {online && (
          <View className="h-10 w-full flex-row items-center gap-2 rounded-full bg-success-tint px-4">
            <View className="size-2.5 rounded-full bg-success" />
            <Text className="flex-1 font-jakarta-medium text-sm text-[#17803d]">
              Online · duty time {formatClock(dutySeconds)}
            </Text>
          </View>
        )}

        <View className="w-full gap-1 rounded-[20px] bg-card px-4 py-3.5 shadow-md shadow-black/10">
          <Text className="font-jakarta-medium text-xs text-muted-foreground">
            Today&rsquo;s earnings
          </Text>
          <Text
            className={
              online
                ? "font-jakarta-bold text-[36px] leading-[42px] text-foreground"
                : "font-jakarta-bold text-[36px] leading-[42px] text-muted-foreground"
            }
          >
            ₹{online && earningsData ? earningsData.totalEarned.toFixed(2) : "0.00"}
          </Text>
          {online && earningsError && (
            <Text className="text-xs text-destructive" onPress={() => refetchEarnings()}>
              Couldn&rsquo;t load today&rsquo;s earnings — tap to retry
            </Text>
          )}
          <Text className="text-xs text-muted-foreground">
            {online
              ? `${earningsData?.orders ?? 0} orders  ·  Cash in hand: ₹${cashInHandData?.cashInHand ?? 0}`
              : "0 orders"}
          </Text>
        </View>

        {online && (
          <View className="w-full gap-6 rounded-[20px] bg-card px-4 pb-1.5 pt-2 shadow-md shadow-black/10">
            <View className="w-full flex-row items-center gap-2.5">
              <Text className="text-lg">🎯</Text>
              <Text className="flex-1 font-jakarta-medium text-sm text-foreground">
                {BONUS_MOCK.bonusTarget} more orders before 3 PM → ₹{BONUS_MOCK.bonusAmount} bonus
              </Text>
            </View>
            <View className="h-1 w-full overflow-hidden rounded-full bg-border">
              <View
                className="h-full rounded-full bg-warning"
                style={{ width: `${BONUS_MOCK.bonusProgressPct}%` }}
              />
            </View>
          </View>
        )}

        {hydrateError && (
          <Pressable onPress={fetchDutyStatus}>
            <Text className="text-center text-sm text-destructive">
              Couldn&rsquo;t load duty status — tap to retry
            </Text>
          </Pressable>
        )}
        {toggleError && (
          <Text className="text-center text-sm text-destructive">{toggleError}</Text>
        )}

        <Button
          size={online ? "sm" : "lg"}
          variant={online ? "secondary" : "default"}
          disabled={isOnline === null || toggling}
          onPress={handleToggleOnline}
        >
          {toggling ? "Updating…" : online ? "Go offline" : "Go online"}
        </Button>
      </View>

      <BottomNav />
    </Screen>
  );
}
