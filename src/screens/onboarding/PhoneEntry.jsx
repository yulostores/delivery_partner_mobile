import { useState } from "react";
import { TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import { usePartnerAuth } from "@/context/PartnerAuthContext";

export default function PhoneEntry() {
  const navigation = useNavigation();
  const { requestOtp } = usePartnerAuth();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isValid = phone.length === 10;

  // requestOtp now hits a real endpoint (rate limiting, network failure, etc. are all real,
  // reachable outcomes here, unlike the mock version this replaced, which never threw) — an
  // unhandled rejection here would otherwise silently strand the user on "Sending…".
  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(phone);
      navigation.navigate("OnboardingOtp");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="h-[200px] w-full gap-1 bg-primary px-6 pb-6 pt-[38px]">
        <Text className="font-jakarta-bold text-2xl leading-[30px] text-white">
          FoodHub Delivery
        </Text>
        <View className="gap-0.5">
          <Text className="text-sm leading-[18px] text-white">Earn on your schedule</Text>
          <Text className="text-sm leading-[18px] text-white">Deliver more. Earn more.</Text>
        </View>
      </View>

      <View className="w-full gap-6 px-6 pt-8">
        <View className="gap-1">
          <Text className="font-jakarta-bold text-xl leading-[25px] text-foreground">
            Enter your mobile number
          </Text>
          <Text className="text-sm text-muted-foreground">
            We&rsquo;ll send a one-time password to verify
          </Text>
        </View>

        <View className="h-12 w-full flex-row items-center gap-4 rounded-full border border-border bg-white px-4">
          <Text className="font-jakarta-medium text-base text-foreground">+91</Text>
          <View className="h-7 w-px bg-border" />
          <TextInput
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
            keyboardType="number-pad"
            placeholder="98765 43210"
            placeholderTextColor="#999999"
            autoFocus
            className="flex-1 font-jakarta text-base text-foreground"
          />
        </View>

        <Button disabled={!isValid || submitting} onPress={handleSubmit}>
          {submitting ? "Sending…" : "Send OTP"}
        </Button>

        {error && (
          <Text className="text-center text-sm text-destructive">{error}</Text>
        )}

        <Text className="text-center font-jakarta-medium text-xs text-muted-foreground">
          By continuing, you agree to our Terms &amp; Privacy Policy
        </Text>
      </View>
    </Screen>
  );
}
