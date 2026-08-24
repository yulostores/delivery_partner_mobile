import { View } from "react-native";

import { cn } from "@/lib/utils";

export default function Card({ className, ...props }) {
  return (
    <View
      className={cn("rounded-[20px] bg-card p-4 shadow-md shadow-black/10", className)}
      {...props}
    />
  );
}
