import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import {
  Ban,
  Bike,
  ChevronRight,
  FileText,
  HelpCircle,
  IdCard,
  Leaf,
  LogOut,
  Mail,
  Shield,
} from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import { usePartnerAuth } from "@/context/PartnerAuthContext";
import client from "@/api/client";
import { TRAINING_STATUS_KEY } from "@/context/OnboardingContext";
import { navigationRef } from "@/navigation/navigationRef";

const MENU_SECTIONS = [
  {
    label: "Fleet",
    rows: [
      {
        icon: Shield,
        label: "Fleet type & change request",
        route: "ProfileFleetChange",
        chipKey: "fleet",
      },
      {
        icon: Leaf,
        label: "Veg Fleet Training",
        chipKey: "training",
        navigate: (navigation) => navigation.navigate("Onboarding", { screen: "OnboardingTraining" }),
      },
    ],
  },
  {
    label: "Details",
    rows: [
      { icon: IdCard, label: "Personal Details", route: "ProfilePersonalDetails" },
      { icon: Bike, label: "Vehicle Details", route: "ProfileVehicleDetails" },
    ],
  },
  {
    label: "Documents",
    rows: [{ icon: FileText, label: "Documents Uploaded", route: "ProfileDocuments" }],
  },
  {
    label: "Support",
    rows: [
      { icon: HelpCircle, label: "Support & help", route: "ProfileHelpSupport" },
      { icon: Mail, label: "Notifications", route: "ProfileNotifications" },
    ],
  },
];

function SectionLabel({ children }) {
  return (
    <Text className="font-jakarta-semibold text-xs uppercase tracking-wide text-[#8a8a8a]">
      {children}
    </Text>
  );
}

function MenuRow({ icon: Icon, label, chip, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center gap-3 rounded-[20px] bg-card px-4 py-2 shadow-md shadow-black/10"
    >
      <View className="size-10 items-center justify-center rounded-xl">
        <Icon size={24} color="#666666" />
      </View>
      <Text className="flex-1 font-jakarta-medium text-sm text-foreground">{label}</Text>
      {chip && (
        <View className="h-7 items-center justify-center rounded-full bg-primary-tint px-3">
          <Text className="font-jakarta-semibold text-xs text-primary-hover">{chip}</Text>
        </View>
      )}
      {onPress && <ChevronRight size={20} color="#999999" />}
    </Pressable>
  );
}

export default function Profile() {
  const navigation = useNavigation();
  const { logout } = usePartnerAuth();
  const [showLogout, setShowLogout] = useState(false);

  const { data } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });
  const partner = data?.partner;
  // Training done: the row says so and stays put — opening the training screen with nothing left
  // to watch bounced the rider to Home without a word.
  const { data: training } = useQuery({
    queryKey: TRAINING_STATUS_KEY,
    queryFn: () => client.get("/partner/training/status"),
    enabled: partner?.verificationStatus === "approved",
  });
  const trainingDone = Boolean(training) && !training.moduleId;
  const isVeg = partner?.fleetType === "veg";
  const fleetLabelLong = isVeg ? "Veg-Only Fleet" : "Standard Fleet";
  const fleetLabelShort = isVeg ? "Veg-Only" : "Standard";

  function handleConfirmLogout() {
    logout();
    // The root stack, not this tab navigator — Onboarding lives at the root.
    navigationRef.reset({ index: 0, routes: [{ name: "Onboarding" }] });
  }

  return (
    <Screen edges={["top"]}>
      <View className="h-[112px] w-full flex-row gap-4 bg-card px-6 pb-3 pt-[18px]">
        <View className="size-12 items-center justify-center rounded-full bg-primary">
          <Text className="font-jakarta-bold text-lg text-white">
            {partner?.fullName?.charAt(0) ?? "?"}
          </Text>
        </View>
        <View className="flex-1 justify-center gap-1.5">
          <Text className="font-jakarta-bold text-xl text-foreground">
            {partner?.fullName ?? "—"}
          </Text>
          <View className="h-7 w-[110px] items-center justify-center rounded-full bg-primary-tint px-3">
            <Text className="font-jakarta-semibold text-xs text-primary-hover">{fleetLabelLong}</Text>
          </View>
          {/* No acceptance-rate/on-time-rate fields exist anywhere on the backend (only
              rating/totalDeliveries) — showing fabricated percentages here would be the same
              mock-data problem this step exists to fix, just moved into a comment instead of a
              constant. Real rating only. */}
          <Text className="text-xs text-muted-foreground">
            ⭐ {Number(partner?.rating) > 0 ? Number(partner.rating).toFixed(1) : "No ratings yet"} · {partner?.totalDeliveries ?? 0} {partner?.totalDeliveries === 1 ? "delivery" : "deliveries"}
          </Text>
        </View>
      </View>

      <ScrollView className="w-full flex-1" contentContainerClassName="gap-5 px-6 pb-6 pt-5">
        {MENU_SECTIONS.map((section) => (
          <View key={section.label} className="w-full gap-2.5">
            <SectionLabel>{section.label}</SectionLabel>
            {section.rows.map((row) => (
              <MenuRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                chip={
                  row.chipKey === "fleet"
                    ? fleetLabelShort
                    : row.chipKey === "training" && trainingDone
                      ? "Completed"
                      : row.chip
                }
                onPress={
                  row.chipKey === "training" && trainingDone
                    ? undefined
                    : () => (row.navigate ? row.navigate(navigation) : navigation.navigate(row.route))
                }
              />
            ))}
          </View>
        ))}

        <View className="w-full gap-2.5">
          <SectionLabel>Account</SectionLabel>
          <MenuRow icon={LogOut} label="Log out" onPress={() => setShowLogout(true)} />
        </View>
      </ScrollView>

      {showLogout && (
        <View className="absolute inset-0 z-10 items-center justify-center bg-black/20 px-6">
          <View className="w-full max-w-[310px] items-center gap-4 rounded-[20px] bg-white p-6 shadow-lg shadow-black/20">
            <View className="size-14 items-center justify-center rounded-full bg-primary-tint">
              <Ban size={28} color="#e53e3e" />
            </View>
            <Text className="text-center font-jakarta-bold text-xl text-foreground">Log out?</Text>
            <Text className="text-center text-sm text-muted-foreground">
              You&rsquo;ll need your registered mobile number to log back in and go online again.
            </Text>
            <Button variant="destructive" className="w-full" onPress={handleConfirmLogout}>
              Log out
            </Button>
            <Button variant="secondary" size="sm" className="w-full" onPress={() => setShowLogout(false)}>
              Cancel
            </Button>
          </View>
        </View>
      )}
    </Screen>
  );
}
