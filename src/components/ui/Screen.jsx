import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

// RN equivalent of the web build's `.app-shell` + manual status-bar spacer:
// SafeAreaView handles the real device notch/status-bar inset, and
// expo-status-bar's `style` swaps the OS status bar's icon color for dark
// headers (e.g. the Training Module video screen).
export default function Screen({ children, className, edges = ["top"], statusBarStyle = "dark" }) {
  return (
    <SafeAreaView edges={edges} className={cn("flex-1 bg-background", className)}>
      <StatusBar style={statusBarStyle} />
      {children}
    </SafeAreaView>
  );
}
