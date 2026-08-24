import { View } from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Hourglass, CheckCircle2, XCircle } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import Stepper from "@/components/partner/Stepper";
import client from "@/api/client";
import { ONBOARDING_STATUS_KEY } from "@/context/OnboardingContext";

const STATUS_COPY = {
  pending_documents: {
    title: "Documents pending",
    body: "Finish uploading all required documents to submit your application for review.",
    step: 0,
    icon: Hourglass,
    iconClass: "bg-warning-tint",
    iconColor: "#f59e0b",
  },
  under_review: {
    title: "Documents under review",
    body: "We’ll notify you within 24 hours once your documents are verified.",
    step: 1,
    icon: Hourglass,
    iconClass: "bg-warning-tint",
    iconColor: "#f59e0b",
  },
  approved: {
    title: "You’re verified!",
    body: "Your application has been approved. Continue to complete your training.",
    step: 2,
    icon: CheckCircle2,
    iconClass: "bg-success-tint",
    iconColor: "#22c55e",
  },
  rejected: {
    title: "Application rejected",
    body: "Your application was rejected. Contact support for more details.",
    step: 1,
    icon: XCircle,
    iconClass: "bg-destructive/10",
    iconColor: "#ef4444",
  },
  resubmission_required: {
    title: "Resubmission required",
    body: "Some of your documents need fixes. Please review the notes below and re-upload.",
    step: 1,
    icon: XCircle,
    iconClass: "bg-destructive/10",
    iconColor: "#ef4444",
  },
};

export default function VerificationStatus() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const { data, isError, refetch } = useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => client.get("/partner/onboarding/status"),
    refetchInterval: isFocused ? 20000 : false,
  });

  // Without this, a failed fetch silently falls back to "pending_documents" — misleading for a
  // partner who's actually already approved and just hit a transient network error.
  if (isError && !data) {
    return (
      <Screen>
        <AppBar title="Application status" />
        <View className="w-full flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-destructive" onPress={() => refetch()}>
            Couldn&rsquo;t load your verification status — tap to retry
          </Text>
        </View>
      </Screen>
    );
  }

  const verificationStatus = data?.verificationStatus ?? "pending_documents";
  const verificationNotes = data?.verificationNotes ?? null;
  const copy = STATUS_COPY[verificationStatus] ?? STATUS_COPY.pending_documents;
  const Icon = copy.icon;
  const showNotes =
    (verificationStatus === "rejected" || verificationStatus === "resubmission_required") &&
    verificationNotes;

  function handleContinueToTraining() {
    // No moduleId param — TrainingModule.jsx now derives its current module entirely from
    // GET /partner/training/status (server-tracked), which is the unambiguous source of truth
    // for "which module is current" now that training isn't local state.
    navigation.navigate("OnboardingTraining");
  }

  return (
    <Screen>
      <AppBar title="Application status" />

      <View className="w-full items-center gap-8 px-6 pt-12">
        <View className={`size-20 items-center justify-center rounded-2xl ${copy.iconClass}`}>
          <Icon size={36} color={copy.iconColor} strokeWidth={1.5} />
        </View>

        <View className="items-center gap-1.5">
          <Text className="text-center font-jakarta-bold text-xl text-foreground">{copy.title}</Text>
          <Text className="text-center text-base text-muted-foreground">{copy.body}</Text>
        </View>

        {showNotes && (
          <View className="w-full gap-1.5 rounded-2xl bg-destructive/10 p-4">
            <Text className="font-jakarta-semibold text-sm text-destructive">Notes from review</Text>
            <Text className="text-sm text-destructive">{verificationNotes}</Text>
          </View>
        )}

        <View className="w-full pt-3">
          <Stepper steps={["Submitted", "Under review", "Approved"]} step={copy.step} />
        </View>

        <View className="w-full gap-3.5 pt-11">
          {verificationStatus === "approved" ? (
            <Button onPress={handleContinueToTraining}>Continue to training</Button>
          ) : (
            <Button>Contact support</Button>
          )}
          <Button variant="secondary" size="sm" onPress={() => navigation.navigate("OnboardingDocuments")}>
            View uploaded documents
          </Button>
          {/* Lets a partner mid-review leave this screen instead of being stuck between
              "Contact support" and "View uploaded documents" — Home renders fine pre-approval,
              it just won't have orders/earnings yet. */}
          <Button variant="ghost" size="sm" onPress={() => navigation.navigate("HomeOffline")}>
            Go to home
          </Button>
        </View>
      </View>
    </Screen>
  );
}
