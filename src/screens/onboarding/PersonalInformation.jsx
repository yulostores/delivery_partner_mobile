import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import DatePickerField, { toDateOnlyString } from "@/components/ui/DatePickerField";
import Input from "@/components/ui/Input";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { cn } from "@/lib/utils";
import client from "@/api/client";
import { usePartnerAuth } from "@/context/PartnerAuthContext";

const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function Field({ label, children }) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-jakarta-medium text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <View className="h-11 w-full flex-row gap-1 rounded-full bg-[#f5f5f5] p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            className={cn(
              "h-9 flex-1 items-center justify-center rounded-full",
              selected && "bg-primary",
            )}
          >
            <Text
              className={cn(
                "text-xs",
                selected
                  ? "font-jakarta-semibold text-white"
                  : "font-jakarta-medium text-muted-foreground",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PersonalInformation() {
  const navigation = useNavigation();
  const { params } = useRoute();
  // Reused as a post-approval edit form from Profile > Personal Details' "Request changes" —
  // backend Step 11's KYC-re-review design assumes editing here after approval, not just during
  // onboarding. When reached that way, return to Profile instead of advancing the onboarding
  // stack forward.
  const fromProfile = params?.fromProfile === true;
  const { user } = usePartnerAuth();
  const queryClient = useQueryClient();
  // Real, already-submitted data if any exists (a partner resuming onboarding after leaving
  // mid-flow) — hydrated below once it loads, rather than starting from a stranger's mock name.
  const { data: profile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const partner = profile?.partner;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState(null);
  const [gender, setGender] = useState("male");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const today = new Date();
  const hundredYearsAgo = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());

  useEffect(() => {
    if (!partner) return;
    setFullName(partner.fullName ?? "");
    setEmail(partner.email ?? "");
    setDob(partner.dateOfBirth ? new Date(partner.dateOfBirth) : null);
    setGender(partner.gender ?? "male");
    setEmergencyPhone(partner.emergencyPhone ?? "");
    setAadharNumber(partner.aadharNumber ?? "");
    setPanNumber(partner.panNumber ?? "");
  }, [partner]);

  async function handleSubmit() {
    // If the hydrate fetch above failed, `partner` (and every field seeded from it) would be
    // blank while the partner's REAL saved data is untouched server-side — submitting anyway
    // would silently overwrite it with empty strings. Block rather than risk that.
    if (profileError) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.patch("/partner/onboarding/personal", {
        fullName,
        email,
        dateOfBirth: toDateOnlyString(dob),
        gender,
        emergencyPhone,
        aadharNumber,
        panNumber,
      });
      // Without this, Profile's PersonalDetails/Profile screens (which read this same query key)
      // would keep showing the pre-edit values for up to staleTime (60s) after returning —
      // confirmed live: the PATCH itself succeeds, but the UI doesn't reflect it.
      queryClient.invalidateQueries({ queryKey: ["partner", "profile"] });
      if (fromProfile) {
        navigation.goBack();
      } else {
        navigation.navigate("OnboardingDocuments");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Personal information" />

      <ScrollView className="w-full px-6 pt-4" contentContainerClassName="gap-4 pb-6">
        {/* Only meaningful inside the linear onboarding stack — fromProfile is a standalone
            edit that goes straight back to Profile on save, not step 2 of anything, so a
            "Step 1 of 4" label here would misleadingly imply a multi-step flow that doesn't
            happen. */}
        {!fromProfile && (
          <View className="gap-2">
            <Text className="font-jakarta-semibold text-[13px] text-muted-foreground">
              Step 1 of 4 · Personal information
            </Text>
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <View className="h-full rounded-full bg-primary" style={{ width: "25%" }} />
            </View>
          </View>
        )}

        <Field label="Full name">
          <Input value={fullName} onChangeText={setFullName} className="rounded-2xl" />
        </Field>

        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            className="rounded-2xl"
          />
        </Field>

        <Field label="Mobile number">
          {/* Read-only: this is the OTP-verified login identifier (unique, set at signup) — the
              backend's onboarding/personal endpoint deliberately doesn't accept changing it here.
              Showing it as freely editable when nothing submitted here would ever persist a
              change would be misleading. */}
          <View className="h-12 justify-center rounded-2xl border border-border bg-muted px-4">
            <Text className="text-base text-muted-foreground">+91 {user?.phone ?? "—"}</Text>
          </View>
        </Field>

        <Field label="Date of birth">
          <DatePickerField
            value={dob}
            onChange={setDob}
            placeholder="Select date of birth"
            maximumDate={today}
            minimumDate={hundredYearsAgo}
          />
        </Field>

        <Field label="Gender">
          <SegmentedControl options={GENDERS} value={gender} onChange={setGender} />
        </Field>

        <Field label="Aadhaar number">
          <Input
            value={aadharNumber}
            onChangeText={setAadharNumber}
            keyboardType="number-pad"
            className="rounded-2xl"
          />
        </Field>

        <Field label="PAN number">
          <Input
            value={panNumber}
            onChangeText={setPanNumber}
            autoCapitalize="characters"
            className="rounded-2xl"
          />
        </Field>

        {profileError && (
          <Text className="text-center text-sm text-destructive" onPress={() => refetchProfile()}>
            Couldn&rsquo;t load your current details — tap to retry before editing
          </Text>
        )}

        <View className="w-full pt-2">
          <Button disabled={submitting || profileError} onPress={handleSubmit}>
            {submitting ? "Saving…" : "Continue"}
          </Button>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Text className="text-center text-xs text-muted-foreground">
          Your Aadhaar &amp; PAN are used only for identity verification and background checks.
        </Text>
      </ScrollView>
    </Screen>
  );
}
