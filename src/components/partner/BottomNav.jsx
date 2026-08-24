import { Pressable, View } from "react-native";
import { Home, Package, User, Wallet } from "lucide-react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";

import { cn } from "@/lib/utils";
import Text from "@/components/ui/Text";

// Routes to OrdersTab, not OrdersIncoming directly — OrdersIncoming needs a real order payload as
// params (pushed by the order_offer socket event or OrdersTab's own current-order check) and
// only ever renders once it has one. OrdersTab owns the "nothing pending" empty state instead of
// silently bouncing back to Home.
const ITEMS = [
  { route: "HomeOffline", label: "Home", icon: Home },
  { route: "OrdersTab", label: "Orders", icon: Package },
  { route: "Earnings", label: "Earn", icon: Wallet },
  { route: "Profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const navigation = useNavigation();
  const currentRoute = useNavigationState((state) => state.routes[state.index]?.name);

  return (
    <View className="h-20 w-full flex-row border-t border-border bg-card">
      {ITEMS.map(({ route, label, icon: Icon }) => {
        const isActive = currentRoute === route;
        const color = isActive ? "#ff5f00" : "#999999";
        return (
          <Pressable
            key={route}
            onPress={() => navigation.navigate(route)}
            className="flex-1 items-center justify-center gap-1"
          >
            <Icon size={18} color={color} />
            <Text
              className={cn("text-xs", isActive ? "font-jakarta-semibold" : "font-jakarta-medium")}
              style={{ color }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
