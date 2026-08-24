import { View } from "react-native";

import { cn } from "@/lib/utils";
import Text from "@/components/ui/Text";

export default function Stepper({ steps, step }) {
  return (
    <View className="w-full gap-2 pl-2">
      <View className="w-full flex-row items-center">
        {steps.map((_, i) => (
          <View key={i} className={cn("flex-row items-center", i < steps.length - 1 ? "flex-1" : "")}>
            <View
              className={cn(
                "size-4 rounded-full border-2",
                i < step && "border-success bg-success",
                i === step && "border-warning bg-warning",
                i > step && "border-border-strong bg-white",
              )}
            />
            {i < steps.length - 1 && (
              <View className={cn("h-0.5 flex-1", i < step ? "bg-success" : "bg-border-strong")} />
            )}
          </View>
        ))}
      </View>
      <View className="w-full flex-row pl-2">
        {steps.map((label, i) => (
          <Text
            key={label}
            className={cn(
              "flex-1 font-jakarta-medium text-xs",
              i === steps.length - 1 && "text-right",
              i < step && "text-success",
              i === step && "text-warning",
              i > step && "text-muted-foreground",
            )}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
