import { Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Wallet } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import client from "@/api/client";
import { DOCUMENT_TYPES } from "@/mocks/fixtures";
import { goToTab } from "@/navigation/tabs";

// One row per KYC document, labelled with where its review stands — it used to say "Uploaded"
// whether the admin had verified it, rejected it or not looked yet. Not tappable (changes go
// through "Request Changes" below), so no chevron.
const REVIEW_CHIP = {
  verified: { label: "Verified", chip: "bg-success-tint", text: "text-success", tile: "bg-success" },
  pending: { label: "Under review", chip: "bg-warning-tint", text: "text-warning", tile: "bg-warning" },
  rejected: { label: "Rejected", chip: "bg-destructive/10", text: "text-destructive", tile: "bg-destructive" },
  missing: { label: "Not uploaded", chip: "bg-muted", text: "text-muted-foreground", tile: "bg-muted" },
};

function UploadedRow({ label, status }) {
  const look = REVIEW_CHIP[status] ?? REVIEW_CHIP.pending;
  return (
    <View className="w-full flex-row items-center gap-3 rounded-[20px] bg-card px-4 py-3 shadow-md shadow-black/10">
      <View className={`size-10 items-center justify-center rounded-xl ${look.tile}`}>
        <FileText size={18} color={status === "missing" ? "#999999" : "#ffffff"} />
      </View>
      <Text className="flex-1 font-jakarta-medium text-base text-foreground">{label}</Text>
      <View className={`h-7 items-center justify-center rounded-full px-3 ${look.chip}`}>
        <Text className={`font-jakarta-semibold text-sm ${look.text}`}>{look.label}</Text>
      </View>
    </View>
  );
}

// Unlike the KYC rows above, bank details are a single editable record rather than a bundle of
// uploads re-submitted together, so this row jumps straight into the edit form on tap instead of
// waiting for the collective "Request Changes" button.
function BankDetailsRow({ added, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center gap-3 rounded-[20px] bg-card px-4 py-3 shadow-md shadow-black/10"
    >
      <View className={`size-10 items-center justify-center rounded-xl ${added ? "bg-success" : "bg-muted"}`}>
        <Wallet size={18} color={added ? "#ffffff" : "#999999"} />
      </View>
      <Text className="flex-1 font-jakarta-medium text-base text-foreground">Bank details</Text>
      <View className={`h-7 items-center justify-center rounded-full px-3 ${added ? "bg-success-tint" : "bg-muted"}`}>
        <Text className={`font-jakarta-semibold text-sm ${added ? "text-success" : "text-muted-foreground"}`}>
          {added ? "Added" : "Not added"}
        </Text>
      </View>
      <ChevronRight size={20} color="#999999" />
    </Pressable>
  );
}

export default function DocumentsUploaded() {
  const navigation = useNavigation();
  const { data } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const documents = data?.partner?.documents ?? [];
  const statusOf = (type) => documents.find((d) => d.type === type)?.status ?? "missing";
  const bankAdded = Boolean(data?.partner?.bankDetails?.accountNumber);

  return (
    <Screen edges={["top"]}>
      {/* Explicit target, not onBack={true}'s goBack() — this screen is also reachable via the
          profile/documents deep link (see linking.js) with no prior screen on the stack, where
          goBack() would just no-op. */}
      <AppBar title="Documents Uploaded" onBack={() => goToTab("Profile")} />

      <View className="gap-4 px-6 pb-6 pt-2">
        {DOCUMENT_TYPES.map((doc) => (
          <UploadedRow key={doc.type} label={doc.label} status={statusOf(doc.type)} />
        ))}

        <BankDetailsRow
          added={bankAdded}
          onPress={() =>
            navigation.navigate("Onboarding", {
              state: {
                routes: [{ name: "OnboardingBankDetails", params: { fromProfile: true } }],
              },
            })
          }
        />

        <Button
          className="mt-2"
          // A real destination now that DocumentUploadHub.jsx (Step 3) actually handles re-upload —
          // was a literal no-op before. fromProfile mirrors PersonalDetails.jsx/VehicleDetails.jsx's
          // pattern so that screen returns here instead of falling through to vehicle details.
          // Passing `state` (not `screen`/`params`) forces the nested Onboarding stack to start
          // clean at OnboardingDocuments — if this partner already went through full onboarding
          // earlier in the same app session, that stack still has OnboardingVehicleDetails etc. in
          // its history, and a plain `navigate` would jump into that leftover state instead of a
          // documents-only screen.
          onPress={() =>
            navigation.navigate("Onboarding", {
              state: {
                routes: [{ name: "OnboardingDocuments", params: { fromProfile: true } }],
              },
            })
          }
        >
          Request Changes
        </Button>
      </View>
    </Screen>
  );
}
