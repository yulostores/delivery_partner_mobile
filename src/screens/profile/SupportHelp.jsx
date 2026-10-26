import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Bug, ChevronRight, Mail, Phone } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import client from "@/api/client";

// Yulo's support number and email come from the public app config (GET /api/app/config →
// config.about), the same values the customer app shows, so there is one place to change them.
// There is no chat integration, so no chat row: a row that does nothing reads as a broken app.
function useSupportContact() {
  const { data } = useQuery({
    queryKey: ["app", "config"],
    queryFn: () => client.get("/app/config"),
    staleTime: 60 * 60_000,
  });
  const about = data?.config?.about;
  return { phone: about?.supportPhone ?? null, email: about?.supportEmail ?? null };
}

export default function SupportHelp() {
  const navigation = useNavigation();
  const { phone, email } = useSupportContact();
  const [error, setError] = useState(null);

  function open(url, fallback) {
    setError(null);
    Linking.openURL(url).catch(() => setError(fallback));
  }

  const callSupport = phone
    ? () => open(`tel:${phone.replace(/[^\d+]/g, "")}`, `Couldn’t open the dialer — call ${phone}`)
    : null;
  const emailSupport = email
    ? () => open(`mailto:${email}`, `Couldn’t open your email app — write to ${email}`)
    : null;

  const rows = [
    callSupport && { key: "call", label: "Call support", detail: phone, Icon: Phone, onPress: callSupport },
    { key: "report", label: "Report an issue", Icon: Bug, onPress: () => navigation.navigate("ProfileReportIssue") },
    emailSupport && { key: "email", label: "Email us", detail: email, Icon: Mail, onPress: emailSupport },
  ].filter(Boolean);

  return (
    <Screen edges={["top"]}>
      <AppBar title="Support & Help" onBack={true} />

      <View className="flex-1 gap-4 px-6 pb-6 pt-2">
        {rows.map(({ key, label, detail, Icon, onPress }) => (
          <Pressable
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            className="w-full flex-row items-center gap-3 rounded-[20px] bg-card px-4 py-3 shadow-md shadow-black/10"
          >
            <View className="h-10 w-10 items-center justify-center">
              <Icon size={22} color="#666" />
            </View>
            <View className="flex-1">
              <Text className="font-jakarta-medium text-base text-foreground">{label}</Text>
              {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
            </View>
            <ChevronRight size={20} color="#999" />
          </Pressable>
        ))}

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        {callSupport && (
          <View className="pt-6">
            <Button onPress={callSupport}>Call support now</Button>
          </View>
        )}
      </View>
    </Screen>
  );
}
