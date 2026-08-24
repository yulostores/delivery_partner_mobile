import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BackButton from "@/components/partner/BackButton";
import OtpInput from "@/components/partner/OtpInput";
import { usePartnerAuth } from "@/context/PartnerAuthContext";

const RESEND_SECONDS = 28;

function formatTimer(s) {
  return `00:${String(s).padStart(2, "0")}`;
}

export default function OtpVerification() {
  const navigation = useNavigation();
  const { pendingPhone, verifyOtp, requestOtp, devOtp } = usePartnerAuth();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  async function handleVerify() {
    if (otp.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const partner = await verifyOtp(otp);
      // Was unconditionally navigating to Personal Information regardless of whether this was a
      // brand-new signup or a RETURNING partner (e.g. logging back in after Profile > Log out) —
      // confirmed live: a fully-approved partner logging back in got dumped straight onto a blank
      // edit form instead of Home. verifyOtp() returns the real partner doc, so route on it:
      if (partner.verificationStatus === "approved") {
        // Bubbles up to the top-level Home route — not part of this nested Onboarding stack.
        navigation.navigate("HomeOffline");
      } else if (partner.fullName) {
        // Submitted personal info at least once before but isn't approved yet (under review,
        // rejected, or asked to resubmit) — VerificationStatus.jsx shows their real state and
        // lets them act on it, rather than re-showing a blank Personal Information form.
        navigation.navigate("OnboardingStatus");
      } else {
        // Brand new partner, first-ever OTP verify — nothing submitted yet.
        navigation.navigate("OnboardingPersonalInfo");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0) return;
    setError(null);
    try {
      await requestOtp(pendingPhone);
    } catch (err) {
      setError(err.message);
      return;
    }
    setSecondsLeft(RESEND_SECONDS);
  }

  return (
    <Screen>
      <View className="w-full flex-row items-start px-4 pt-3">
        <BackButton />
      </View>

      <View className="w-full gap-1 px-6 pt-8">
        <Text className="font-jakarta-bold text-[32px] leading-[40px] text-foreground">
          Verify your number
        </Text>
        <Text className="text-base text-muted-foreground">
          6-digit OTP sent to +91 {pendingPhone ?? "98765 43210"}
        </Text>
      </View>

      <View className="w-full pt-9">
        <OtpInput value={otp} onChange={setOtp} />
      </View>

      {/* DEV-ONLY: no real SMS provider exists anywhere in this codebase (see
          server/services/otp.service.js) — this is the only way to actually test the OTP flow.
          devOtp is only ever set when the backend response includes one, which itself only
          happens when NODE_ENV !== 'production'; never rendered against a real prod backend. */}
      {devOtp && (
        <Pressable onPress={() => setOtp(devOtp)} className="w-full px-6 pt-3">
          <Text className="text-center font-jakarta-medium text-xs text-muted-foreground">
            Dev OTP: {devOtp} (tap to fill)
          </Text>
        </Pressable>
      )}

      {error && (
        <Text className="w-full px-6 pt-3 text-center text-sm text-destructive">{error}</Text>
      )}

      <View className="w-full flex-row items-center gap-6 px-6 pt-[26px]">
        <Text className="text-sm text-muted-foreground">Didn&rsquo;t receive it?</Text>
        {secondsLeft > 0 ? (
          <Text className="font-jakarta-semibold text-sm text-primary">
            Resend in {formatTimer(secondsLeft)}
          </Text>
        ) : (
          <Pressable onPress={handleResend}>
            <Text className="font-jakarta-semibold text-sm text-primary">Resend OTP</Text>
          </Pressable>
        )}
      </View>

      <View className="w-full px-6 pt-6">
        <Button disabled={otp.length !== 6 || verifying} onPress={handleVerify}>
          {verifying ? "Verifying…" : "Verify OTP"}
        </Button>
      </View>
    </Screen>
  );
}
