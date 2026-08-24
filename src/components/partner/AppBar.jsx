import { Pressable, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

import { cn } from "@/lib/utils";
import Text from "@/components/ui/Text";

// `onBack` renders a leading chevron (Figma's chevron-left + title "App Bar"
// variant used across the Profile/Account flow); pass `true` to just go back,
// or a function for custom behavior. Screens that don't need it keep the
// original title-only layout.
export default function AppBar({ title, theme = "light", className, onBack }) {
  const dark = theme === "dark";
  const navigation = useNavigation();
  const handleBack = onBack === true ? () => navigation.goBack() : onBack;

  return (
    <View
      className={cn(
        "h-14 w-full flex-row items-center gap-4",
        onBack ? "pl-4 pr-6" : "px-6",
        dark ? "bg-[#141414]" : "bg-card",
        className,
      )}
    >
      {handleBack && (
        <Pressable onPress={handleBack} accessibilityLabel="Go back" hitSlop={8}>
          <ChevronLeft size={24} color={dark ? "#ffffff" : "#1a1a1a"} />
        </Pressable>
      )}
      <Text
        className={cn(
          "flex-1",
          dark ? "font-jakarta-semibold text-[14px] text-white" : "font-jakarta-bold text-[20px] text-foreground",
        )}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}
