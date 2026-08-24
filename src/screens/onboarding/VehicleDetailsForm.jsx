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
import { VEHICLE_TYPES } from "@/mocks/fixtures";

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

export default function VehicleDetailsForm() {
  const navigation = useNavigation();
  const { params } = useRoute();
  // Reused as a post-approval edit form from Profile > Vehicle Details' "Request changes" — see
  // PersonalInformation.jsx's identical fromProfile handling for why.
  const fromProfile = params?.fromProfile === true;
  const queryClient = useQueryClient();
  const { data: profile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const vehicle = profile?.partner?.vehicle;

  const [type, setType] = useState(VEHICLE_TYPES[0].value);
  const [model, setModel] = useState("");
  // Named `number` (not `registrationNumber`) to match server/models/DeliveryPartner.js's
  // vehicle.number field exactly.
  const [number, setNumber] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  // Named `insuranceNumber` (not `insurancePolicyNumber`) to match the backend field.
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [insuranceValidTill, setInsuranceValidTill] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Bounds for the insurance-validity picker — generous on both sides (some records predate this
  // picker and may already show an expired policy; others may be freshly renewed for years out),
  // but still finite so the calendar can't be driven into the same "January 112233" kind of
  // nonsense DatePickerField.jsx guards against for out-of-range values.
  const today = new Date();
  const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
  const twentyYearsAhead = new Date(today.getFullYear() + 20, today.getMonth(), today.getDate());

  useEffect(() => {
    if (!vehicle) return;
    setType(vehicle.type ?? VEHICLE_TYPES[0].value);
    setModel(vehicle.model ?? "");
    setNumber(vehicle.number ?? "");
    setRcNumber(vehicle.rcNumber ?? "");
    setInsuranceProvider(vehicle.insuranceProvider ?? "");
    setInsuranceNumber(vehicle.insuranceNumber ?? "");
    setInsuranceValidTill(vehicle.insuranceValidTill ? new Date(vehicle.insuranceValidTill) : null);
  }, [vehicle]);

  async function handleSubmit() {
    // See PersonalInformation.jsx's identical guard — a failed hydrate would leave every field
    // blank while the partner's real saved vehicle data is untouched server-side; submitting
    // anyway would overwrite it with empty strings.
    if (profileError) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.patch("/partner/onboarding/vehicle", {
        vehicle: {
          model,
          number,
          type,
          rcNumber,
          insuranceProvider,
          insuranceNumber,
          insuranceValidTill: toDateOnlyString(insuranceValidTill),
        },
      });
      // See PersonalInformation.jsx's identical fix — without this, Profile's VehicleDetails
      // screen (same query key) would keep showing pre-edit values for up to staleTime.
      queryClient.invalidateQueries({ queryKey: ["partner", "profile"] });
      if (fromProfile) {
        navigation.goBack();
      } else {
        navigation.navigate("OnboardingBankDetails");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AppBar title="Vehicle details" />

      <ScrollView className="w-full px-6 pt-4" contentContainerClassName="gap-4 pb-6">
        {/* See PersonalInformation.jsx's identical fix — fromProfile is a standalone edit that
            goes straight back to Profile on save, not step 4 of anything. */}
        {!fromProfile && (
          <View className="gap-2">
            <Text className="font-jakarta-semibold text-[13px] text-muted-foreground">
              Step 3 of 4 · Vehicle details
            </Text>
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <View className="h-full rounded-full bg-primary" style={{ width: "75%" }} />
            </View>
          </View>
        )}

        <Field label="Vehicle type">
          <SegmentedControl options={VEHICLE_TYPES} value={type} onChange={setType} />
        </Field>

        <Field label="Vehicle model">
          <Input value={model} onChangeText={setModel} className="rounded-2xl" />
        </Field>

        <Field label="Vehicle registration number">
          <Input
            value={number}
            onChangeText={setNumber}
            autoCapitalize="characters"
            className="rounded-2xl"
          />
        </Field>

        <Field label="RC number">
          <Input
            value={rcNumber}
            onChangeText={setRcNumber}
            autoCapitalize="characters"
            className="rounded-2xl"
          />
        </Field>

        <Field label="Insurance provider">
          <Input value={insuranceProvider} onChangeText={setInsuranceProvider} className="rounded-2xl" />
        </Field>

        <Field label="Insurance policy number">
          <Input
            value={insuranceNumber}
            onChangeText={setInsuranceNumber}
            autoCapitalize="characters"
            className="rounded-2xl"
          />
        </Field>

        <Field label="Insurance validity">
          <DatePickerField
            value={insuranceValidTill}
            onChange={setInsuranceValidTill}
            placeholder="Select insurance validity date"
            minimumDate={tenYearsAgo}
            maximumDate={twentyYearsAhead}
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
          Make sure your RC and insurance are valid — we&rsquo;ll verify these against your uploaded
          documents.
        </Text>
      </ScrollView>
    </Screen>
  );
}
