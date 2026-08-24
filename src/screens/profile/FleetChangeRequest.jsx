import { useState } from "react";
import { Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { cn } from "@/lib/utils";
import client from "@/api/client";

const REASONS = [
  "Not enough orders on veg fleet",
  "Moving to a different zone",
  "Equipment issue (bag problem)",
  "Personal reason",
];

const FLEET_LABEL = { veg: "Veg-Only Fleet", standard: "Standard Fleet" };

export default function FleetChangeRequest() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [selectedReason, setSelectedReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { data: profile } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const currentFleetType = profile?.partner?.fleetType;
  // Only two fleet types exist at all, so "the other one" is unambiguous — there's no picker UI
  // here because there's nothing to pick between.
  const requestedFleetType = currentFleetType === "veg" ? "standard" : "veg";

  // Also the real source for expectedResponseHours before any request has been submitted — the
  // create endpoint only returns it once one exists, but this GET always includes it.
  const { data: history, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ["partner", "fleet-change-requests"],
    queryFn: () => client.get("/partner/fleet-change-requests"),
  });
  const expectedResponseHours = history?.expectedResponseHours;

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.post("/partner/fleet-change-requests", {
        requestedFleetType,
        reason: selectedReason,
        notes: notes.trim() || undefined,
      });
      // RequestSubmitted.jsx reads this same query key — invalidate so it refetches the
      // just-created request instead of serving the pre-submission cache (60s staleTime).
      queryClient.invalidateQueries({ queryKey: ["partner", "fleet-change-requests"] });
      navigation.navigate("ProfileFleetChangeSubmitted");
    } catch (err) {
      if (err.code === "ALREADY_PENDING") {
        // Functionally the same next step either way — show the existing pending request's real
        // status rather than blocking on an error here.
        queryClient.invalidateQueries({ queryKey: ["partner", "fleet-change-requests"] });
        navigation.navigate("ProfileFleetChangeSubmitted");
      } else {
        // Covers the "already on the requested fleet" case (VALIDATION_ERROR) — the backend's own
        // message already reads naturally ("You are already on the X fleet").
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <AppBar title="Request Fleet Change" onBack={true} />

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        <Card className="gap-2">
          <Text className="text-xs text-muted-foreground">Current fleet</Text>
          <View className="h-7 w-[110px] items-center justify-center rounded-full bg-primary-tint px-3">
            <Text className="font-jakarta-semibold text-xs text-primary-hover">
              {FLEET_LABEL[currentFleetType] ?? "—"}
            </Text>
          </View>
        </Card>

        <Card className="gap-2">
          <Text className="text-xs text-muted-foreground">Requesting</Text>
          <View className="h-7 w-[110px] items-center justify-center rounded-full bg-success-tint px-3">
            <Text className="font-jakarta-semibold text-xs text-[#17803d]">
              {FLEET_LABEL[requestedFleetType]}
            </Text>
          </View>
        </Card>

        <Text className="pt-2 font-jakarta-semibold text-base text-foreground">
          Why do you want to change?
        </Text>

        <View className="w-full gap-2.5">
          {REASONS.map((reason) => {
            const isSelected = reason === selectedReason;
            return (
              <Pressable
                key={reason}
                onPress={() => setSelectedReason(reason)}
                className={cn(
                  "h-[52px] w-full justify-center rounded-full border px-4",
                  isSelected ? "border-2 border-primary bg-primary-tint" : "border-border bg-white",
                )}
              >
                <Text
                  className={cn(
                    "text-sm",
                    isSelected ? "font-jakarta-semibold text-primary-hover" : "text-foreground",
                  )}
                >
                  {reason}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          className="rounded-full"
          placeholder="Additional notes (optional)…"
          value={notes}
          onChangeText={setNotes}
        />

        <View className="h-11 w-full items-center justify-center rounded-[20px] bg-success-tint px-4">
          {historyError ? (
            <Text
              className="font-jakarta-medium text-sm text-destructive"
              onPress={() => refetchHistory()}
            >
              Couldn&rsquo;t load — tap to retry
            </Text>
          ) : (
            <Text className="font-jakarta-medium text-sm text-[#17803d]">
              ⏱ {expectedResponseHours != null ? `Ops responds within ${expectedResponseHours} hours` : "Loading…"}
            </Text>
          )}
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Button className="w-full" disabled={submitting || !currentFleetType} onPress={handleSubmit}>
          {submitting ? "Submitting…" : "Submit request"}
        </Button>
      </View>
    </Screen>
  );
}
