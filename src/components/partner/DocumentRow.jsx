import { Pressable, View } from "react-native";
import { ChevronRight, FileText } from "lucide-react-native";

import { cn } from "@/lib/utils";
import Text from "@/components/ui/Text";

const TILE_CLASS = {
  uploaded: "bg-success-tint",
  next: "bg-warning-tint",
  pending: "bg-muted",
};
const TILE_ICON_COLOR = {
  uploaded: "#22a853",
  next: "#f59e0b",
  pending: "#999999",
};
const CHIP_CLASS = {
  uploaded: "bg-success-tint",
  next: "bg-muted",
  pending: "bg-muted",
};
const CHIP_TEXT_CLASS = {
  uploaded: "text-success",
  next: "text-muted-foreground",
  pending: "text-muted-foreground",
};

export default function DocumentRow({ label, status, onPress }) {
  const isUploaded = status === "uploaded";
  return (
    <Pressable
      onPress={onPress}
      className="w-full flex-row items-center gap-3 rounded-[20px] bg-card px-4 py-3 shadow-md shadow-black/10"
    >
      <View className={cn("size-10 items-center justify-center rounded-xl", TILE_CLASS[status])}>
        <FileText size={18} color={TILE_ICON_COLOR[status]} />
      </View>
      <Text className="flex-1 font-jakarta-medium text-[16px] text-foreground">{label}</Text>
      <View className={cn("h-7 items-center justify-center rounded-full px-3", CHIP_CLASS[status])}>
        <Text className={cn("font-jakarta-semibold text-[14px]", CHIP_TEXT_CLASS[status])}>
          {isUploaded ? "Uploaded" : "Not uploaded"}
        </Text>
      </View>
      <ChevronRight size={20} color="#999999" />
    </Pressable>
  );
}
