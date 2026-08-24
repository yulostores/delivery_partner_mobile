import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { Package, Settings, Target, Volume2, Wallet } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import client from "@/api/client";

const TOGGLES = [
  { key: "orders", label: "New order alerts", Icon: Package },
  { key: "payments", label: "Payment & earnings updates", Icon: Wallet },
  { key: "promotions", label: "Promotions & offers", Icon: Target },
  { key: "appUpdates", label: "App updates", Icon: Settings },
  { key: "soundVibration", label: "Sound & vibration", Icon: Volume2 },
];

const DEFAULTS = { orders: true, payments: true, promotions: true, appUpdates: true, soundVibration: true };

function ToggleRow({ label, Icon, enabled, onToggle }) {
  return (
    <View className="w-full flex-row items-center gap-3 rounded-[20px] bg-card px-4 py-3 shadow-md shadow-black/10">
      <View className="h-10 w-10 items-center justify-center">
        <Icon size={22} color="#666" />
      </View>
      <Text className="flex-1 font-jakarta-medium text-base text-foreground">{label}</Text>
      <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: "#ff5f00" }} />
    </View>
  );
}

export default function Notifications() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data } = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => client.get("/partner/profile"),
  });

  useEffect(() => {
    if (data?.partner?.notificationPreferences) {
      setPrefs({ ...DEFAULTS, ...data.partner.notificationPreferences });
    }
  }, [data]);

  function toggle(key) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await client.patch("/partner/notifications", prefs);
      // Invalidate rather than trust the local optimistic state as final — the next mount (e.g.
      // after an app restart) reads this same GET /partner/profile query fresh.
      queryClient.invalidateQueries({ queryKey: ["partner", "profile"] });
      navigation.goBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={["top"]}>
      <AppBar title="Notifications" onBack={true} />

      <View className="flex-1 gap-4 px-6 pb-6 pt-2">
        {TOGGLES.map(({ key, label, Icon }) => (
          <ToggleRow key={key} label={label} Icon={Icon} enabled={prefs[key]} onToggle={() => toggle(key)} />
        ))}

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <View className="pt-6">
          <Button disabled={saving} onPress={handleSave}>
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </View>
      </View>
    </Screen>
  );
}
