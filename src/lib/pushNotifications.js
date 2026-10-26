import { Platform, Vibration } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import client from "@/api/client";
import { resumeCurrentOrder } from "@/lib/currentOrder";

/**
 * Push notifications — how an order offer reaches a rider whose phone is locked or whose app is in
 * the background. Android closes the app's socket within moments of that, so an offer sent only
 * over the socket (partnerSocket.js) was never seen. The backend sends every offer both ways
 * (server/services/push.service.js); this file registers the phone's Expo push token with it and
 * opens the offer when the rider taps the notification.
 *
 * Needs a development or store build with Firebase configured (google-services.json + the FCM
 * key uploaded to EAS) — see docs/push-notifications.md. Without that, getting a token fails and
 * everything here quietly does nothing: offers still arrive over the socket while the app is open.
 */

// Channel ids the backend sends to (server/services/push.service.js PUSH_CHANNELS). On Android the
// importance, sound and vibration belong to the channel, and can't be changed after it is created
// except by the rider in system settings — so get them right here.
const CHANNELS = [
  {
    id: "order-offers",
    name: "New delivery requests",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
  },
  {
    id: "order-updates",
    name: "Order updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  },
];

let _configured = false;

/** Call once at startup (App.js). Safe to call again. */
export function configureNotifications() {
  if (_configured || Platform.OS === "web") return;
  _configured = true;

  // While the app is open the offer screen itself is the alert (partnerSocket.js navigates to it),
  // so an offer push only makes its sound then — no banner on top of the screen it just opened.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const isOffer = notification.request.content.data?.type === "order_offer";
      return {
        shouldShowBanner: !isOffer,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });

  if (Platform.OS === "android") {
    for (const { id, ...channel } of CHANNELS) {
      Notifications.setNotificationChannelAsync(id, {
        ...channel,
        sound: "default",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      }).catch(() => {});
    }
  }

  // Tapping a notification while the app is running opens whatever is live for this rider — the
  // offer, or the delivery. A tap that launches the app from closed needs nothing here: Home reads
  // the duty status once signed in and opens the live offer itself.
  Notifications.addNotificationResponseReceivedListener(() => {
    resumeCurrentOrder();
  });
}

/**
 * Registers this phone for the signed-in rider. `ask` shows the system permission prompt if it
 * hasn't been answered — pass it only from a tap (going online). On resume or launch it is false,
 * because a prompt then sends the app to the background and back, which fires resume again.
 */
export async function registerPushToken({ ask = false } = {}) {
  if (Platform.OS === "web") return;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && ask) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return;
    // Sent every time (launch, resume, going online), not just when it changes here: the server
    // may have dropped it meanwhile (another rider signed in on this phone, or Expo reported it
    // unregistered), and one small request per resume is cheap.
    await client.put("/partner/notifications/push-token", { token });
  } catch {
    // No Firebase config in this build, offline, or Expo unreachable — the socket still works
    // while the app is open; the next launch or going online tries again.
  }
}

/** Signing out: this phone stops receiving the rider's offers. */
export async function unregisterPushToken() {
  try {
    // Capped: signing out waits on this, and a dead connection must not leave it hanging.
    await client.delete("/partner/notifications/push-token", { timeout: 5000 });
  } catch {
    // Best-effort — the server also drops a token Expo reports as unregistered.
  }
}

/** A buzz when an offer lands while the app is open, so a rider glancing away doesn't miss it. */
export function alertNewOffer() {
  if (Platform.OS === "web") return;
  Vibration.vibrate([0, 400, 200, 400]);
}
