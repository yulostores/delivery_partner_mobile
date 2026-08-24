import { View } from "react-native";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import Text from "./Text";

const badgeVariants = cva("h-7 items-center justify-center rounded-full px-3", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-success-tint",
      warning: "bg-warning-tint",
      muted: "bg-muted",
    },
  },
  defaultVariants: { variant: "muted" },
});

const textVariants = cva("font-jakarta-semibold text-[14px]", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      success: "text-success",
      warning: "text-warning",
      muted: "text-muted-foreground",
    },
  },
  defaultVariants: { variant: "muted" },
});

export default function Badge({ variant, className, textClassName, children }) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      <Text className={cn(textVariants({ variant }), textClassName)}>{children}</Text>
    </View>
  );
}
