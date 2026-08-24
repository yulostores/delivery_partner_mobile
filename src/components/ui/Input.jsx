import { TextInput } from "react-native";

import { cn } from "@/lib/utils";

export default function Input({ className, ...props }) {
  return (
    <TextInput
      placeholderTextColor="#999999"
      className={cn(
        "h-12 w-full rounded-full border border-border bg-white px-4 font-jakarta text-[16px] text-foreground",
        className,
      )}
      {...props}
    />
  );
}
