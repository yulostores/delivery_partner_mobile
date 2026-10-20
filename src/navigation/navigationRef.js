import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside any screen component (partnerSocket.js's order_offer handler, in
// particular) trigger real navigation — NavigationContainer is given this ref in App.js.
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

// The focused route ({ name, params }) or null — for socket handlers deciding whether a push is
// about what the rider is looking at right now.
export function getCurrentRoute() {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
}
