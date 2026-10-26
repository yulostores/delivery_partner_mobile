import { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";

import client, { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from "@/api/client";
import { setRefreshToken, clearRefreshToken } from "@/api/tokenStorage";
import { disconnectPartnerSocket } from "@/lib/partnerSocket";
import { stopLocationPings } from "@/lib/locationPings";
import { unregisterPushToken } from "@/lib/pushNotifications";
import { clearDutyStart } from "@/lib/dutyClock";
import { navigationRef } from "@/navigation/navigationRef";

// Back to the phone-number screen with nothing underneath, so Back can't return to a signed-in screen.
function resetToSignIn() {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: "Onboarding" }] });
  }
}

const PROFILE_KEY = "yulo_partner_profile";

const PartnerAuthContext = createContext(null);

export function PartnerAuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [pendingPhone, setPendingPhone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Dev-only: the backend only ever includes this when NODE_ENV !== 'production' (see
  // server/services/otp.service.js) — there's no real SMS provider anywhere in this codebase, so
  // this is the only way to actually test the OTP flow without one. Never present in prod
  // responses, so this naturally stays null/unused there.
  const [devOtp, setDevOtp] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY)
      .then(async (raw) => {
        if (!raw) return;
        const cachedProfile = JSON.parse(raw);
        // A cached profile with no valid access token yet is a worse first-load experience than
        // proactively refreshing here — otherwise the user appears "logged in" (profile present)
        // but the very first real request has to go through Step 1's 401-retry path before
        // anything actually works.
        let accessToken;
        try {
          accessToken = await refreshAccessToken();
        } catch {
          // Offline at launch: the session is still good. Keep the rider signed in — the first
          // request that needs a token refreshes it once the connection is back. (Signing out
          // here logged riders out whenever they opened the app without signal.)
          setUser(cachedProfile);
          return;
        }
        if (accessToken) {
          setUser(cachedProfile);
        } else {
          // Refresh token missing/expired/revoked — the cached profile isn't usable without a
          // live session. Drop it rather than leave the app in a half-authenticated state.
          await AsyncStorage.removeItem(PROFILE_KEY);
          await clearRefreshToken();
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (user) AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    else AsyncStorage.removeItem(PROFILE_KEY);
  }, [user, hydrated]);

  const requestOtp = useCallback(async (phone) => {
    setPendingPhone(phone);
    const result = await client.post("/partner/auth/request-otp", { phone });
    if (result.devOtp) {
      console.log(`[dev] OTP for ${phone}: ${result.devOtp}`);
      setDevOtp(result.devOtp);
    } else {
      setDevOtp(null);
    }
    return result;
  }, []);

  const verifyOtp = useCallback(
    async (otp) => {
      setLoading(true);
      try {
        const { partner, accessToken, refreshToken } = await client.post("/partner/auth/verify-otp", {
          phone: pendingPhone,
          otp,
        });
        // Query cache is keyed by fixed keys like ["partner", "onboarding", "status"], not by
        // partner id — without clearing here, a fresh sign-in reuses whatever the *previous*
        // signed-in partner left cached (up to the 60s staleTime in App.js) and briefly shows
        // their onboarding/training data instead of refetching for the new partner.
        queryClient.clear();
        setAccessToken(accessToken);
        await setRefreshToken(refreshToken);
        setUser(partner);
        return partner;
      } finally {
        setLoading(false);
      }
    },
    [pendingPhone, queryClient],
  );

  // Everything held on this phone for the session, dropped. Shared by logout and by a session the
  // server has ended (refresh token expired or revoked).
  const clearLocalSession = useCallback(async () => {
    // Without this, a partner who logs out while online stays joined to their partner:{id}
    // socket room and counted in the backend's live:active_partners presence set under a
    // session that's no longer authenticated.
    disconnectPartnerSocket();
    stopLocationPings();
    setAccessToken(null);
    await clearRefreshToken().catch(() => {});
    await clearDutyStart();
    queryClient.clear();
    setUser(null);
    setPendingPhone(null);
    setDevOtp(null);
  }, [queryClient]);

  const logout = useCallback(async () => {
    // While still signed in — the server needs the session for each of these. Going off duty
    // first: otherwise the rider stays 'active' on the server and can still be picked for orders
    // after signing out. Refused mid-delivery (PARTNER_BUSY), which is fine — best-effort.
    await client.post("/partner/duty/toggle", { online: false }, { timeout: 5000 }).catch(() => {});
    await unregisterPushToken();
    try {
      await client.post("/partner/auth/logout", null, { timeout: 5000 });
    } catch {
      // Best-effort — even if this fails (network down, token already invalid), still clear
      // everything client-side below so the user isn't stuck "logged in" locally.
    }
    await clearLocalSession();
  }, [clearLocalSession]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearLocalSession().finally(resetToSignIn);
    });
    return () => setSessionExpiredHandler(null);
  }, [clearLocalSession]);

  return (
    <PartnerAuthContext.Provider
      value={{
        user,
        loading,
        hydrated,
        pendingPhone,
        devOtp,
        requestOtp,
        verifyOtp,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </PartnerAuthContext.Provider>
  );
}

export function usePartnerAuth() {
  const ctx = useContext(PartnerAuthContext);
  if (!ctx) throw new Error("usePartnerAuth must be inside PartnerAuthProvider");
  return ctx;
}
