import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import DeliveryMap from "@/components/delivery/DeliveryMap";
import client from "@/api/client";
import { connectPartnerSocket, disconnectPartnerSocket } from "@/lib/partnerSocket";
import { startLocationPings, stopLocationPings } from "@/lib/locationPings";
import { registerPushToken } from "@/lib/pushNotifications";
import { resumeCurrentOrder } from "@/lib/currentOrder";
import { usePartnerConfig } from "@/lib/partnerConfig";
import { formatClock, formatCurrency } from "@/lib/format";
import { clearDutyStart, getOrStartDuty } from "@/lib/dutyClock";

// No bonus/incentive card: there is no incentive programme behind it on the backend, and a
// hardcoded "3 more orders → ₹120 bonus" promised riders money nobody would pay.

const greetingFor = (hour) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

// 'busy' (mid-delivery) counts as on-duty for display purposes even though the toggle can't
// flip it off directly (the backend 409s — see handleToggleOnline).
const ON_DUTY_STATUSES = new Set(["active", "busy"]);

// The live map around the rider (HERE tiles, the same component as the pickup/drop-off screens,
// with no destination pin). The backend has no demand data yet, so no heat overlay is drawn — a
// made-up one would send riders to areas with no orders.
function HomeMap() {
  return (
    <View className="h-[300px] w-full overflow-hidden bg-muted">
      <DeliveryMap />
      <View className="absolute left-4 top-2 h-7 items-center justify-center rounded-full bg-card px-3 shadow-md shadow-black/10">
        <Text className="font-jakarta-semibold text-xs text-foreground">Your location</Text>
      </View>
    </View>
  );
}

export default function Home() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { codEnabled } = usePartnerConfig();
  // Why the rider was sent back here — e.g. "Order cancelled — no need to deliver"
  // (lib/orderGone.js). Re-shown for each new noticeAt; dismissed by tapping it.
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (params?.notice) setNotice(params.notice);
  }, [params?.notice, params?.noticeAt]);

  // null = not hydrated yet from the backend's real duty status; deliberately not defaulting to
  // false/offline, since a partner who force-quit the app while online should reopen it and see
  // themselves still online.
  const [isOnline, setIsOnline] = useState(null);
  const [hydrateError, setHydrateError] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState(null);
  const [dutySeconds, setDutySeconds] = useState(0);
  const intervalRef = useRef(null);
  // Counted from a stored start time rather than by adding a second per tick: JS timers freeze
  // while the app is in the background, so a tick counter fell behind on every phone lock and
  // restarted from zero whenever the app was reopened.
  const startClock = useCallback(async () => {
    const startedAt = await getOrStartDuty();
    const tick = () => setDutySeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    clearInterval(intervalRef.current);
    tick();
    intervalRef.current = setInterval(tick, 1000);
  }, []);

  const stopClock = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setDutySeconds(0);
    clearDutyStart();
  }, []);

  // The backend's duty status is the truth; this screen mirrors it. Read on mount AND on every
  // return to the foreground — reading it only on mount left the switch showing whatever it
  // showed before the app was backgrounded (or killed and relaunched), which looked like the app
  // going online and offline by itself.
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
        resumeCurrentOrder();
        // Checks only — never prompts here (see locationPings.js start()).
        startLocationPings();
        registerPushToken();
      } else {
        stopClock();
        disconnectPartnerSocket();
        stopLocationPings();
      }
    } catch {
      // Couldn't reach the server: keep showing what we last knew rather than flipping to
      // "offline" — the rider hasn't changed anything, and the backend still has them on duty.
      setHydrateError(true);
    }
  }, [startClock, stopClock]);

  useEffect(() => {
    fetchDutyStatus();
    return () => clearInterval(intervalRef.current);
  }, [fetchDutyStatus]);

  const { data: profileData, refetch: refetchProfile } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  // Home stays mounted under the tabs, so the cached profile would otherwise keep showing the
  // pre-approval state (and the "Check your verification status" prompt) after an approval.
  useFocusEffect(
    useCallback(() => {
      refetchProfile();
    }, [refetchProfile]),
  );

  // App backgrounding doesn't unmount this screen (no fresh mount-effect fires), so on return to
  // the foreground: re-read the duty status, and if on duty rejoin the socket the OS may have
  // dropped and open any offer that arrived meanwhile (fetchDutyStatus does all of that).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        fetchDutyStatus();
        refetchProfile();
      }
    });
    return () => subscription.remove();
  }, [fetchDutyStatus, refetchProfile]);

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
        // The rider just tapped "Go online": the one moment to ask for location and
        // notification permission.
        // One after the other: Android shows one permission prompt at a time.
        startLocationPings({ ask: true }).finally(() => registerPushToken({ ask: true }));
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
  // cache rather than fetching separately. Read offline too: today's earnings and the cash still
  // to deposit don't stop being true when the rider goes off duty (it used to read ₹0.00 · 0 orders
  // the moment they went offline, right after a day's deliveries).
  const {
    data: earningsData,
    isError: earningsError,
    refetch: refetchEarnings,
  } = useQuery({
    queryKey: ["partner", "earnings", "today"],
    queryFn: () => client.get("/partner/earnings?period=today"),
  });
  // Cash in hand only exists for cash-on-delivery orders — not fetched or shown while COD is off.
  const { data: cashInHandData } = useQuery({
    queryKey: ["partner", "earnings", "cash-in-hand"],
    queryFn: () => client.get("/partner/earnings/cash-in-hand"),
    enabled: codEnabled,
  });
  const fleetType = profileData?.partner?.fleetType;
  const fleetLabel = fleetType === "veg" ? "Veg-Only Fleet" : "Standard Fleet";
  // Sourced from this same profile fetch, not usePartnerAuth()'s `user` — that's only ever set
  // once at login (verifyOtp()) and never refreshed, so it still held the pre-onboarding blank
  // name for the rest of the session even after PersonalInformation.jsx saved the real name.
  const firstName = profileData?.partner?.fullName?.split(" ")[0];
  // Not approved yet: the app opens on Home for any signed-in partner (RootNavigator can't tell
  // from the profile cached at sign-in), and "Go online" only answers "Complete verification".
  // This is the way back into onboarding — the first step for a partner who hasn't sent their
  // details yet, otherwise the status screen (under review / rejected / approved → training).
  const verificationStatus = profileData?.partner?.verificationStatus;
  const needsOnboarding = !online && Boolean(verificationStatus) && verificationStatus !== "approved";
  const resumeOnboarding = () =>
    navigation.navigate("Onboarding", {
      screen: profileData?.partner?.fullName ? "OnboardingStatus" : "OnboardingPersonalInfo",
    });

  return (
    <Screen edges={["top"]}>
      <View className="h-16 w-full flex-row items-center justify-between bg-card pl-6 pr-5">
        <Text className="font-jakarta-semibold text-[16px] text-foreground">
          {greetingFor(new Date().getHours())}{firstName ? `, ${firstName}` : ""}
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
        <HomeMap />
      ) : (
        <View className="h-[328px] w-full items-center justify-center bg-muted px-6">
          <Text className="text-center text-sm text-muted-foreground">
            Go online to see the map
          </Text>
        </View>
      )}

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        {notice && (
          <Pressable
            onPress={() => setNotice(null)}
            className="w-full rounded-[20px] border border-destructive bg-destructive/10 px-4 py-3"
          >
            <Text className="font-jakarta-semibold text-sm text-destructive">{notice}</Text>
            <Text className="text-xs text-muted-foreground">Tap to dismiss</Text>
          </Pressable>
        )}
        {needsOnboarding && (
          <Pressable
            onPress={resumeOnboarding}
            className="w-full rounded-[20px] border border-primary bg-primary-tint px-4 py-3"
          >
            <Text className="font-jakarta-semibold text-sm text-foreground">
              {profileData?.partner?.fullName ? "Check your verification status" : "Finish your registration"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              You can go online once your details are verified. Tap to continue.
            </Text>
          </Pressable>
        )}
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
            {formatCurrency(Number(earningsData?.totalEarned) || 0)}
          </Text>
          {earningsError && (
            <Text className="text-xs text-destructive" onPress={() => refetchEarnings()}>
              Couldn&rsquo;t load today&rsquo;s earnings — tap to retry
            </Text>
          )}
          <Text className="text-xs text-muted-foreground">
            {`${earningsData?.orders ?? 0} ${earningsData?.orders === 1 ? "order" : "orders"}${
              codEnabled ? `  ·  Cash in hand: ${formatCurrency(Number(cashInHandData?.cashInHand) || 0)}` : ""
            }`}
          </Text>
        </View>

        {hydrateError && (
          <Pressable onPress={fetchDutyStatus}>
            <Text className="text-center text-sm text-destructive">
              {isOnline === null
              ? "Couldn\u2019t load duty status — tap to retry"
              : "Couldn\u2019t refresh duty status — tap to retry"}
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
          {isOnline === null ? "Checking status…" : toggling ? "Updating…" : online ? "Go offline" : "Go online"}
        </Button>
      </View>

    </Screen>
  );
}
