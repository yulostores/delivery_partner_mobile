import { View } from "react-native";

import { cn } from "@/lib/utils";

export default function ProgressBar({ value, size = "md", className }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View className={cn("w-full overflow-hidden rounded-full bg-border-strong", size === "sm" ? "h-1" : "h-2", className)}>
      <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </View>
  );
}
