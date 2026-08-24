import { isValidElement } from "react";
import { Pressable } from "react-native";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import Text from "./Text";

const containerVariants = cva("items-center justify-center rounded-full flex-row gap-2", {
  variants: {
    variant: {
      default: "bg-primary shadow-md shadow-primary/40",
      secondary: "bg-white border-[1.5px] border-primary-hover",
      ghost: "bg-transparent",
      destructive: "bg-destructive",
      disabled: "bg-border-strong",
    },
    size: {
      default: "h-12 px-6",
      sm: "h-10 px-6",
      lg: "h-14 px-8",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

const textVariants = cva("font-jakarta-semibold text-center", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      secondary: "text-primary-hover",
      ghost: "text-foreground",
      destructive: "text-destructive-foreground",
      disabled: "text-muted-foreground",
    },
    size: {
      default: "text-[14px]",
      sm: "text-[14px]",
      lg: "text-base",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export default function Button({
  children,
  variant,
  size,
  disabled,
  className,
  textClassName,
  onPress,
  ...props
}) {
  const effectiveVariant = disabled && variant !== "disabled" ? "disabled" : variant;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      className={cn(
        containerVariants({ variant: effectiveVariant, size }),
        disabled && "opacity-100",
        className,
      )}
      {...props}
    >
      {isValidElement(children) ? (
        children
      ) : (
        // Covers plain strings AND interpolated JSX (e.g. `Continue {n}`,
        // which arrives as an array of nodes, not a single string) — RN
        // throws if a bare text node is a direct child of a View/Pressable,
        // so anything that isn't already a real element gets wrapped here.
        <Text className={cn(textVariants({ variant: effectiveVariant, size }), textClassName)}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
