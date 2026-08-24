import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";

import { cn } from "@/lib/utils";
import Text from "@/components/ui/Text";

// Six visible boxes driven by one off-screen TextInput that holds real
// keyboard focus — RN has no `sr-only`, so the input is rendered at 1x1/opacity 0
// instead of visually hidden the way the web version's <input> was.
export default function OtpInput({
  length = 6,
  value,
  onChange,
  className,
  boxHeight = 60,
  boxWidth = 52,
  accessibilityLabel = "OTP code",
}) {
  const inputRef = useRef(null);
  const digits = value.split("");

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      className={cn("flex-row justify-center gap-2", className)}
    >
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={length}
        style={{ position: "absolute", opacity: 0, height: 1, width: 1 }}
        accessibilityLabel={accessibilityLabel}
      />
      {Array.from({ length }).map((_, i) => {
        const filled = i < digits.length;
        const active = i === digits.length;
        return (
          <View
            key={i}
            style={{ height: boxHeight, width: boxWidth }}
            className={cn(
              "items-center justify-center rounded-xl border",
              active ? "border-2 border-primary bg-primary-tint" : "border-border bg-white",
            )}
          >
            <Text className="font-jakarta-bold text-2xl text-foreground">
              {filled ? digits[i] : ""}
            </Text>
          </View>
        );
      })}
    </Pressable>
  );
}
