import { View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ban } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import Stepper from "@/components/partner/Stepper";
import { goToTab } from "@/navigation/tabs";

export default function SkipConfirmed() {
  const navigation = useNavigation();
  // Reached on a Skip tap, or when the offer's countdown ran out — the latter isn't a skip the
  // rider chose, and calling it one hid that they had missed an order.
  const timedOut = Boolean(useRoute().params?.timedOut);
  const title = timedOut ? "Offer expired" : "Order skipped";

  return (
    <Screen>
      <AppBar title={title} />

      <View className="w-full items-center gap-8 px-6 pt-12">
        <View className="size-[100px] items-center justify-center rounded-2xl bg-warning/[0.12]">
          <Ban size={40} color="#f59e0b" />
        </View>

        <View className="items-center gap-1.5">
          <Text className="text-center font-jakarta-bold text-xl text-foreground">
            {title}
          </Text>
          <Text className="text-center text-base text-muted-foreground">
            {timedOut ? "You didn’t respond in time. " : ""}No penalty applied. We&rsquo;re finding you the next order now.
          </Text>
        </View>

        <View className="w-full pt-3">
          <Stepper steps={[timedOut ? "Expired" : "Skipped", "Searching", "New order"]} step={1} />
        </View>

        <View className="w-full pt-11">
          <Button onPress={() => goToTab("HomeOffline")}>Back to home</Button>
        </View>
      </View>
    </Screen>
  );
}
