import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { Play } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import ProgressBar from "@/components/partner/ProgressBar";
import { useOnboarding } from "@/context/OnboardingContext";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import client from "@/api/client";

const CHECKLIST = [
  "Inspect bag seal before every pickup",
  "No other items in bag",
  "Spill protocol & reporting",
  "Wrong item handover flow",
];

// No real quiz UI exists anywhere on this screen (CHECKLIST above is a watch-percentage
// indicator, not a quiz) — matches server/services/training.service.js's MAX_QUIZ_SCORE. Always
// reporting the max score is an honest placeholder (nothing was actually graded), unlike the old
// TrainingComplete.jsx's fabricated "9 / 10" that implied a real quiz had happened.
const PLACEHOLDER_QUIZ_SCORE = 10;

export default function TrainingModule() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { training, trainingError, refreshTrainingStatus } = useOnboarding();
  const [isPlaying, setIsPlaying] = useState(false);
  const [localWatchedSeconds, setLocalWatchedSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const tickCountRef = useRef(0);
  // Tracks which moduleId local state was last seeded for — re-seed happens when this DIFFERS
  // from training.moduleId, not on every render where `training` merely changes reference.
  const seededForModuleIdRef = useRef(null);

  // Not reachable unapproved (server 403s — see assertApprovedForTraining) or once training is
  // already fully complete (moduleId null then, nothing left to show here). Gated on isFocused:
  // React Navigation's web target keeps this screen mounted (hidden) rather than unmounting it
  // after navigating to TrainingComplete, so its effects keep reacting to prop changes in the
  // background — without this gate, invalidating the training-status query after completing the
  // LAST module (moduleId becomes null) fires this redirect on the now-backgrounded instance and
  // stomps the navigate to TrainingComplete that just happened. Confirmed live.
  useEffect(() => {
    if (!isFocused) return;
    if (trainingError || (training && !training.moduleId)) {
      navigation.navigate("HomeOffline");
    }
  }, [trainingError, training, navigation, isFocused]);

  // Seeds local playback state from the real server value once per distinct module — this is
  // what makes progress actually resume from where the server last saw it after an app restart
  // mid-module (instead of always restarting at 0), AND what resets local state correctly when
  // moving to the next module (React Navigation's default navigate() reuses this same screen
  // instance rather than remounting it, since "OnboardingTraining" is already in the stack).
  // Deliberately keyed on moduleId rather than re-seeding on every render where `training`
  // changes: `isPlaying` flips back to false the instant playback naturally finishes too (see the
  // isDone effect below), and re-seeding at that exact moment from the still-stale
  // pre-playback watchedSeconds would snap the just-completed progress straight back down to 0
  // for the SAME module — confirmed live, this was a real bug before keying on moduleId.
  useEffect(() => {
    if (training && training.moduleId !== seededForModuleIdRef.current) {
      setLocalWatchedSeconds(training.watchedSeconds);
      seededForModuleIdRef.current = training.moduleId;
    }
  }, [training]);

  const durationSeconds = training?.durationSeconds ?? 0;
  const isDone = durationSeconds > 0 && localWatchedSeconds >= durationSeconds;

  // Periodic real progress sync — every 3rd tick (~45 simulated seconds at the playback interval
  // below) or the tick that finishes the module, not every single 150ms tick. The backend clamps
  // this to be monotonic and capped at the real duration, so there's no need to duplicate that
  // logic here — just report what's been watched.
  useEffect(() => {
    if (!isPlaying || !training) return;
    if (tickCountRef.current % 3 === 0 || isDone) {
      client
        .patch("/partner/training/progress", {
          moduleId: training.moduleId,
          watchedSeconds: localWatchedSeconds,
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWatchedSeconds]);

  // Stopping the interval and flipping local `isPlaying` state belongs here, not inside the
  // setLocalWatchedSeconds updater above — updater functions must stay pure since React can
  // invoke them outside the normal render/commit cycle.
  useEffect(() => {
    if (isDone && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPlaying(false);
    }
  }, [isDone]);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  if (!training || !training.moduleId) return null;

  const { moduleId, moduleLabel, moduleIndex, totalModules } = training;
  const pct = (localWatchedSeconds / durationSeconds) * 100;

  function handlePlay() {
    if (isPlaying || isDone) return;
    setIsPlaying(true);
    tickCountRef.current = 0;
    // Simulated playback — fast-forwarded so the flow can be walked through
    // without waiting out a real several-minute video.
    intervalRef.current = setInterval(() => {
      tickCountRef.current += 1;
      setLocalWatchedSeconds((prev) => Math.min(prev + 15, durationSeconds));
    }, 150);
  }

  async function handleCompleteModule() {
    if (!isDone || completing) return;
    setCompleting(true);
    setError(null);
    try {
      // The periodic progress sync above is fire-and-forget (never awaited), so the final tick's
      // PATCH could still be in flight — or not yet even sent — the instant this button becomes
      // enabled. Explicitly flushing the real final value here first guarantees the server has
      // recorded a full watch before /complete checks for one, rather than racing it. Confirmed
      // live: without this, /complete could 400 with MODULE_NOT_WATCHED despite the UI already
      // showing full progress.
      await client.patch("/partner/training/progress", { moduleId, watchedSeconds: localWatchedSeconds });
      const status = await client.post(`/partner/training/${moduleId}/complete`, {
        quizScore: PLACEHOLDER_QUIZ_SCORE,
      });
      // Navigate away BEFORE invalidating — completing the LAST module makes the refetched
      // training.moduleId null, which (while this screen is still mounted) immediately trips its
      // own "training already complete, redirect home" guard effect above, racing the intended
      // navigate to TrainingComplete and sometimes winning it. Confirmed live: invalidating first
      // could land the partner back on Home instead of the completion screen after the 3rd
      // module. Reusing the same screen instance for the next module (Step 8's own design) still
      // gets fresh data because TrainingComplete's own "Continue" re-navigates here afterward,
      // triggering a fresh render against whatever the cache holds by then.
      navigation.navigate("OnboardingTrainingComplete", {
        completedModuleLabel: moduleLabel,
        completedModuleIndex: moduleIndex,
        totalModules,
        watchedSeconds: localWatchedSeconds,
        lastQuizScore: status.lastQuizScore,
        certificateStatus: status.certificateStatus,
      });
      refreshTrainingStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Screen edges={["top", "bottom"]} className="bg-[#1a1a1a]" statusBarStyle="light">
      <AppBar theme="dark" title={`${moduleLabel} · Module ${moduleIndex} of ${totalModules}`} />

      <View className="h-[236px] w-full items-center justify-center bg-[#1a1a1a]">
        <Pressable
          onPress={handlePlay}
          accessibilityLabel="Play training video"
          className="size-14 items-center justify-center rounded-full bg-white"
        >
          <Play size={22} color="#ff5f00" fill="#ff5f00" style={{ marginLeft: 3 }} />
        </Pressable>
      </View>

      <View className="w-full flex-1 bg-background pb-12 pt-3.5">
        <View className="gap-2 px-6">
          <ProgressBar value={pct} size="sm" />
          <View className="w-full flex-row justify-between">
            <Text className="font-jakarta-medium text-xs text-muted-foreground">
              {formatDuration(localWatchedSeconds)}
            </Text>
            <Text className="font-jakarta-medium text-xs text-muted-foreground">
              {formatDuration(durationSeconds)}
            </Text>
          </View>
        </View>

        <View className="flex-1 justify-between px-6 pt-[17px]">
          <View className="gap-[18px]">
            <Text className="font-jakarta-semibold text-lg text-foreground">
              Veg order handling &amp; bag hygiene
            </Text>
            <View className="gap-[18px]">
              {CHECKLIST.map((label, i) => {
                const done = pct >= (i + 1) * 25;
                return (
                  <View key={label} className="flex-row items-center gap-2">
                    <View className={cn("size-2 rounded-full", done ? "bg-success" : "bg-border-strong")} />
                    <Text
                      className={cn(
                        "flex-1 text-sm",
                        done ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </Text>
                    {done && <Text className="font-jakarta-bold text-sm text-success">✓</Text>}
                  </View>
                );
              })}
            </View>
          </View>

          {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

          <Button
            variant={isDone ? "default" : "disabled"}
            disabled={!isDone || completing}
            onPress={handleCompleteModule}
          >
            {completing ? "Submitting…" : isDone ? "Continue to results" : "Continue — watch to unlock"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}
