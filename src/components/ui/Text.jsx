import { Text as RNText } from "react-native";

import { cn } from "@/lib/utils";

// RN has no `body` element to inherit font/color from, so every piece of
// text goes through this wrapper instead of raw RN <Text> — same role
// index.css's `body { font-family; color }` played on the web build.
export default function Text({ className, ...props }) {
  return <RNText className={cn("font-jakarta text-base text-foreground", className)} {...props} />;
}
