import { ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { cn } from "@/lib/utils";
import client from "@/api/client";
import { VEHICLE_TYPES } from "@/mocks/fixtures";

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

// Read-only display only — highlights whichever entry matches the real partner's vehicle.type.
function VehicleTypeField({ value }) {
  return (
    <View className="gap-1.5">
      <Text className="font-jakarta-medium text-xs text-muted-foreground">Vehicle type</Text>
      <View className="h-12 flex-row items-center rounded-xl border border-border bg-[#f5f5f5] p-1">
        {VEHICLE_TYPES.map((tab) => {
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
                  "text-center text-xs",
                  selected ? "font-jakarta-semibold text-white" : "text-muted-foreground",
                )}
                numberOfLines={1}
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

export default function VehicleDetails() {
  const navigation = useNavigation();
  const { data } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const vehicle = data?.partner?.vehicle;

  return (
    <Screen edges={["top"]}>
      <AppBar title="Vehicle details" onBack={true} />

      <ScrollView contentContainerClassName="gap-4 px-6 pb-6 pt-3">
        <VehicleTypeField value={vehicle?.type} />
        <Field label="Vehicle model" value={vehicle?.model} />
        <Field label="Vehicle registration number" value={vehicle?.number} />
        <Field label="RC number" value={vehicle?.rcNumber} />
        <Field label="Insurance provider" value={vehicle?.insuranceProvider} />
        <Field label="Insurance policy number" value={vehicle?.insuranceNumber} />
        <Field
          label="Insurance validity"
          value={vehicle?.insuranceValidTill ? new Date(vehicle.insuranceValidTill).toDateString() : null}
        />

        <Button
          className="mt-2"
          onPress={() =>
            navigation.navigate("Onboarding", { screen: "OnboardingVehicleDetails", params: { fromProfile: true } })
          }
        >
          Request Changes
        </Button>

        <Text className="pt-1 text-center text-xs text-muted-foreground">
          Make sure your RC and insurance are valid — we&rsquo;ll verify these against your
          uploaded documents.
        </Text>
      </ScrollView>
    </Screen>
  );
}
