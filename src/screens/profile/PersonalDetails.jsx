import { ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { cn } from "@/lib/utils";
import client from "@/api/client";
import { usePartnerAuth } from "@/context/PartnerAuthContext";

const GENDER_TABS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function Field({ label, value }) {
  return (
    <View className="gap-1.5">
      <Text className="font-jakarta-medium text-xs text-muted-foreground">{label}</Text>
      <View className="h-12 justify-center rounded-xl border border-border bg-[#f5f5f5] px-4">
        <Text className="text-sm text-foreground">{value ?? "—"}</Text>
      </View>
    </View>
  );
}

// Read-only display only — no dedicated tap handler per tab, this just highlights whichever
// value matches the real partner's gender.
function GenderField({ value }) {
  return (
    <View className="gap-1.5">
      <Text className="font-jakarta-medium text-xs text-muted-foreground">Gender</Text>
      <View className="h-12 flex-row items-center rounded-xl border border-border bg-[#f5f5f5] p-1">
        {GENDER_TABS.map((tab) => {
          const selected = tab.value === value;
          return (
            <View
              key={tab.value}
              className={cn(
                "h-full flex-1 items-center justify-center rounded-lg",
                selected ? "bg-primary" : "bg-transparent",
              )}
            >
              <Text
                className={cn(
                  "text-sm",
                  selected ? "font-jakarta-semibold text-white" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function PersonalDetails() {
  const navigation = useNavigation();
  const { user } = usePartnerAuth();
  const { data } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const partner = data?.partner;

  return (
    <Screen edges={["top"]}>
      <AppBar title="Personal Details" onBack={true} />

      <ScrollView contentContainerClassName="gap-4 px-6 pb-6 pt-3">
        <Field label="Full name" value={partner?.fullName} />
        <Field label="Email" value={partner?.email} />
        <Field label="Mobile number" value={user?.phone ? `+91 ${user.phone}` : null} />
        <Field label="Emergency contact" value={partner?.emergencyPhone} />
        <Field
          label="Date of birth"
          value={partner?.dateOfBirth ? new Date(partner.dateOfBirth).toDateString() : null}
        />
        <GenderField value={partner?.gender} />
        <Field label="Aadhaar number" value={partner?.aadharNumber} />
        <Field label="PAN number" value={partner?.panNumber} />

        <Button
          className="mt-2"
          // Reuses the same real form Step 3 already wired for onboarding (backend's KYC-re-review
          // design assumes edits happen through this same PATCH endpoint post-approval too) —
          // fromProfile tells that screen to return here instead of advancing the onboarding stack.
          onPress={() =>
            navigation.navigate("Onboarding", { screen: "OnboardingPersonalInfo", params: { fromProfile: true } })
          }
        >
          Request changes
        </Button>

        <Text className="pt-1 text-center text-xs text-muted-foreground">
          Your Aadhaar & PAN are used only for identity verification and background checks.
        </Text>
      </ScrollView>
    </Screen>
  );
}
