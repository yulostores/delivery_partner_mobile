import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside any screen component (partnerSocket.js's order_offer handler, in
// particular) trigger real navigation — NavigationContainer is given this ref in App.js.
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
