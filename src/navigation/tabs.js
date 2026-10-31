import { CommonActions, StackActions } from "@react-navigation/native";

import { navigationRef } from "@/navigation/navigationRef";

// The four bottom-bar destinations live in one tab navigator, mounted as the root stack's "Main"
// screen (see RootNavigator.jsx). Switching between them is a tab switch — no stack push, no
// native transition, nothing to reset.
export const MAIN = "Main";
export const TAB_ROUTES = ["HomeOffline", "OrdersTab", "Earnings", "Profile"];

/**
 * Opens a bottom-bar tab from anywhere — a delivery screen, an onboarding screen, a socket
 * handler. Pops the root stack back to "Main" (closing whatever flow is on top of it) and selects
 * the tab; when "Main" isn't in the stack yet (just signed in from onboarding) it takes the
 * current screen's place.
 *
 * Use this rather than navigate("HomeOffline"): from a stack screen, navigate() would push a
 * second copy of "Main" on top of the first.
 */
export function goToTab(tab, params) {
  if (!navigationRef.isReady()) return;
  navigationRef.dispatch(StackActions.popTo(MAIN, { screen: tab, params }));
}

// The screens of a single order offer: the offer itself and its skip-reason sheet.
const OFFER_ROUTES = new Set(["OrdersIncoming", "OrdersReject"]);

/**
 * Leaves an order offer for whatever comes next (pickup after Accept, the skipped / expired
 * screen) and drops the offer from the history. With a plain navigate() the offer stayed
 * underneath, so Back from the pickup screen reopened an already-accepted offer frozen on
 * "Accepting…", with Accept and Skip still on screen.
 */
export function leaveOffer(navigation, name, params) {
  navigation.dispatch((state) => {
    const routes = state.routes.filter((r) => !OFFER_ROUTES.has(r.name));
    return CommonActions.reset({
      ...state,
      routes: [...routes, { name, params }],
      index: routes.length,
    });
  });
}
