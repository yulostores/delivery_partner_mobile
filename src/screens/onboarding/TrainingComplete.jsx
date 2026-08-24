import { useEffect } from "react";
import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Check } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import BottomNav from "@/components/partner/BottomNav";
import { formatDuration } from "@/lib/format";

// Matches server/services/training.service.js's MAX_QUIZ_SCORE.
const MAX_QUIZ_SCORE = 10;

export default function TrainingComplete() {
  const navigation = useNavigation();
  const { params } = useRoute();

  useEffect(() => {
    if (!params) navigation.navigate("HomeOffline");
  }, [params, navigation]);

  if (!params) return null;

  const {
    completedModuleLabel,
    completedModuleIndex,
    totalModules,
    watchedSeconds,
    lastQuizScore,
    certificateStatus,
  } = params;
  const hasNextModule = completedModuleIndex < totalModules;

  // Real per-module content switching is handled by TrainingModule.jsx re-fetching
  // GET /partner/training/status itself (the server already advanced currentModuleId when this
  // module's /complete call succeeded) — this screen doesn't need to know which module is next,
  // just whether one exists.
  function handleContinue() {
    if (hasNextModule) {
      navigation.navigate("OnboardingTraining");
    } else {
      navigation.navigate("HomeOffline");
    }
  }

  const rows = [
    { label: "Quiz score", value: `${lastQuizScore} / ${MAX_QUIZ_SCORE}` },
    { label: "Watch time", value: formatDuration(watchedSeconds) },
    { label: "Result", value: "Passed" },
    {
      label: "Certificate",
      value: certificateStatus === "issued" ? "Issued" : "Pending",
      accent: true,
    },
    { label: "Next up", value: hasNextModule ? `Module ${completedModuleIndex + 1}` : "—" },
  ];

  return (
    <Screen edges={["top", "bottom"]}>
      <View className="h-[200px] w-full items-center gap-5 bg-success px-6 pb-6 pt-[26px]">
        <View className="size-16 items-center justify-center rounded-full bg-white">
          <Check size={28} color="#22a853" strokeWidth={3} />
        </View>
        <View className="items-center gap-0.5">
          <Text className="font-jakarta-bold text-2xl text-white">Module complete!</Text>
          <Text className="text-sm text-white">
            {completedModuleLabel} · Module {completedModuleIndex} of {totalModules}
          </Text>
        </View>
      </View>

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        <View className="w-full gap-3.5 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-base text-foreground">Your progress</Text>
          <View className="gap-3.5">
            {rows.map((row) => (
              <View key={row.label} className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">{row.label}</Text>
                <Text
                  className={
                    row.accent
                      ? "font-jakarta-semibold text-sm text-success"
                      : "text-sm text-foreground"
                  }
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <View className="h-px w-full bg-border" />
          <View className="flex-row items-center justify-between">
            <Text className="font-jakarta-bold text-base text-foreground">Overall</Text>
            <Text className="font-jakarta-bold text-xl text-primary">
              {completedModuleIndex} / {totalModules}
            </Text>
          </View>
        </View>

        <Button onPress={handleContinue}>
          {hasNextModule ? `Continue to Module ${completedModuleIndex + 1}` : "Done"}
        </Button>
      </View>

      <BottomNav />
    </Screen>
  );
}
