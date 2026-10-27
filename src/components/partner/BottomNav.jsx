import { Pressable, View } from "react-native";
import { Home, Package, User, Wallet } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";
import Text from "@/components/ui/Text";
import { goToTab } from "@/navigation/tabs";

// Routes to OrdersTab, not OrdersIncoming directly — OrdersIncoming needs a real order payload as
// params (pushed by the order_offer socket event or OrdersTab's own current-order check) and
// only ever renders once it has one. OrdersTab shows what's live, or the "nothing pending" state.
const ITEMS = [
  { route: "HomeOffline", label: "Home", icon: Home },
  { route: "OrdersTab", label: "Orders", icon: Package },
  { route: "Earnings", label: "Earn", icon: Wallet },
  { route: "Profile", label: "Profile", icon: User },
];

/**
 * The bottom bar, in two places:
 *  - As the tab navigator's own bar (RootNavigator's MainTabs passes `state` and `navigation`):
 *    a tap is a tab switch, and the bar pads itself above the phone's navigation bar.
 *  - On a few stack screens shown over the tabs (an offer, a delivery summary…), rendered with no
 *    props: a tap closes that screen and opens the tab (goToTab). Those screens already sit inside
 *    a bottom safe area, so no extra padding here.
 *
 * Why tabs: the four destinations used to be screens in the root stack, so every tap was a native
 * push (or a move of an existing screen to the top), and Home reset the whole stack 400ms after it
 * appeared. Taps landing mid-transition were dropped, and after a few quick switches the native
 * stack could be left mid-transition with touches blocked until the app was restarted.
 */
export default function BottomNav({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const inTabBar = Boolean(state && navigation);
  const activeRoute = inTabBar ? state.routes[state.index]?.name : null;

  function open(route) {
    if (!inTabBar) {
      goToTab(route);
      return;
    }
    const target = state.routes.find((r) => r.name === route);
    const event = navigation.emit({ type: "tabPress", target: target?.key, canPreventDefault: true });
    if (activeRoute !== route && !event.defaultPrevented) navigation.navigate(route);
  }

  return (
    <View
      className="w-full flex-row border-t border-border bg-card"
      style={{ height: 80 + (inTabBar ? insets.bottom : 0), paddingBottom: inTabBar ? insets.bottom : 0 }}
    >
      {ITEMS.map(({ route, label, icon: Icon }) => {
        const isActive = activeRoute === route;
        const color = isActive ? "#ff5f00" : "#999999";
        return (
          <Pressable
            key={route}
            onPress={() => open(route)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            hitSlop={4}
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
