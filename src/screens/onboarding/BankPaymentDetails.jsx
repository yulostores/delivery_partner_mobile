import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { cn } from "@/lib/utils";
import client from "@/api/client";
import { ACCOUNT_TYPES } from "@/mocks/fixtures";
import { useOnboarding } from "@/context/OnboardingContext";

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

export default function BankPaymentDetails() {
  const navigation = useNavigation();
  const { params } = useRoute();
  // Reused as a post-approval edit form from Profile > Documents Uploaded's "Bank details" row —
  // see PersonalInformation.jsx's identical fromProfile handling for why.
  const fromProfile = params?.fromProfile === true;
  const { refreshOnboardingStatus } = useOnboarding();
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const bankDetails = profile?.partner?.bankDetails;

  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES[0].value);
  const [ifsc, setIfsc] = useState("");
  const [branchName, setBranchName] = useState("");
  const [upiId, setUpiId] = useState("");
  // No `paymentPreference` field — the backend's bankDetails schema doesn't have one (nor any
  // upiId-as-primary-method concept beyond upiId already being a plain field above). Inventing
  // one here would just be silently discarded on submit.
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bankDetails) return;
    setBankName(bankDetails.bankName ?? "");
    setAccountHolderName(bankDetails.accountHolderName ?? "");
    setAccountNumber(bankDetails.accountNumber ?? "");
    setAccountType(bankDetails.accountType ?? ACCOUNT_TYPES[0].value);
    setIfsc(bankDetails.ifscCode ?? "");
    setBranchName(bankDetails.branchName ?? "");
    setUpiId(bankDetails.upiId ?? "");
  }, [bankDetails]);

  async function handleSubmit() {
    // See PersonalInformation.jsx's identical guard — a failed hydrate would leave every field
    // blank while the partner's real saved bank details are untouched server-side; submitting
    // anyway would overwrite them with empty strings before submit-for-review even runs.
    if (profileError) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.patch("/partner/onboarding/bank", {
        bankDetails: {
          bankName,
          accountHolderName,
          accountNumber,
          accountType,
          ifscCode: ifsc,
          branchName,
          upiId,
        },
      });

      if (fromProfile) {
        // Standalone edit, same as PersonalInformation.jsx/VehicleDetailsForm.jsx's fromProfile
        // handling — a re-review resubmit here would incorrectly bounce an already-approved
        // partner into OnboardingStatus's under-review screen.
        queryClient.invalidateQueries({ queryKey: ["partner", "profile"] });
        navigation.goBack();
        return;
      }

      // Submit-for-review happens here, not on DocumentUploadHub.jsx — the actual onboarding
      // stack order is Personal -> Documents -> Vehicle -> Bank, so bank details (the last field
      // the backend's completeness check requires) aren't set until this screen. Calling submit
      // right after Documents would always 400 with INCOMPLETE_ONBOARDING.
      try {
        await client.post("/partner/onboarding/submit");
      } catch (submitErr) {
        // Already under review / already approved just means there's nothing left to submit —
        // treat as success and move on rather than blocking the partner here.
        if (submitErr.code !== "ALREADY_UNDER_REVIEW" && submitErr.code !== "ALREADY_APPROVED") {
          throw submitErr;
        }
      }

      // Without this, VerificationStatus.jsx's first render would show the pre-submit cached
      // status (App.js's QueryClient sets a 60s default staleTime, so a fresh mount otherwise
      // serves stale "pending_documents" data for up to a minute instead of the just-submitted
      // "under_review" state) — confirmed live before adding this.
      refreshOnboardingStatus();
      navigation.navigate("OnboardingStatus");
    } catch (err) {
      if (err.code === "INCOMPLETE_ONBOARDING") {
        const missing = err.details?.missing ?? [];
        setError(
          missing.length > 0
            ? `Please complete: ${missing.join(", ")}`
            : "Please complete all onboarding steps before submitting.",
        );
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Bank & payment details" onBack={fromProfile ? true : undefined} />

      <ScrollView className="w-full px-6 pt-4" contentContainerClassName="gap-4 pb-6">
        {/* See PersonalInformation.jsx's identical fix — fromProfile is a standalone edit, not
            step 4 of an in-progress wizard. */}
        {!fromProfile && (
          <View className="gap-2">
            <Text className="font-jakarta-semibold text-[13px] text-muted-foreground">
              Step 4 of 4 · Bank &amp; payment
            </Text>
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <View className="h-full rounded-full bg-primary" style={{ width: "100%" }} />
            </View>
          </View>
        )}

        <Field label="Bank name">
          <Input value={bankName} onChangeText={setBankName} className="rounded-2xl" />
        </Field>

        <Field label="Account holder name">
          <Input value={accountHolderName} onChangeText={setAccountHolderName} className="rounded-2xl" />
        </Field>

        <Field label="Account number">
          <Input
            value={accountNumber}
            onChangeText={setAccountNumber}
            autoCapitalize="characters"
            className="rounded-2xl"
          />
        </Field>

        <Field label="Account type">
          <SegmentedControl options={ACCOUNT_TYPES} value={accountType} onChange={setAccountType} />
        </Field>

        <Field label="IFSC code">
          <Input value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" className="rounded-2xl" />
        </Field>

        <Field label="Branch name">
          <Input value={branchName} onChangeText={setBranchName} className="rounded-2xl" />
        </Field>

        <Field label="UPI ID">
          <Input
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
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
            {submitting ? "Saving…" : fromProfile ? "Save changes" : "Finish setup"}
          </Button>
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Text className="text-center text-xs text-muted-foreground">
          Payouts are settled daily to your selected account or UPI ID.
        </Text>
      </ScrollView>
    </Screen>
  );
}
