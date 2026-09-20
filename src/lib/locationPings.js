import axios from "axios";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import client, { getAccessToken, setAccessToken } from "@/api/client";
import { API_BASE } from "@/api/config";
import { getRefreshToken } from "@/api/tokenStorage";

/**
 * Location reporting for an on-duty partner.
 *
 * WHY THIS IS A BACKGROUND TASK AND NOT A TIMER.
 * This used to be a plain `setInterval` under foreground-only permission. That works for exactly
 * as long as the rider is staring at the app — which is never, because they are riding. The
 * moment the screen locks or the app goes to the background, Android throttles and then freezes
 * JS timers. Pings stop, the backend marks the position stale after 120s (see the server's
 * geo.service.js LOCATION_FRESHNESS_SECONDS), and on the customer's tracking screen the rider
 * marker stops moving and then disappears entirely, taking the ETA with it. It was the single
 * largest gap between this platform and a mature delivery app.
 *
 * The fix is the same one every real delivery app uses: a background location task backed by an
 * Android foreground service. The persistent notification is not a side effect to be minimised —
 * it is the thing that keeps the process alive and the thing that makes the tracking honest to
 * the rider, who can see at a glance that their location is being shared and can go off duty to
 * stop it.
 *
 * SCOPE. Tracking runs only while the partner is explicitly on duty. `startLocationPings` is
 * called from the online/offline toggle in screens/home/Home.jsx and `stopLocationPings` from
 * going offline or signing out, so location is never collected from a partner who has not just
 * chosen to receive orders. That user-initiated, clearly-bounded scope is also what makes the
 * Play Store background-location declaration defensible — see docs/background-location.md.
 */

const LOCATION_TASK = "yulo-partner-location";

// Meaningfully shorter than the backend's LOCATION_FRESHNESS_SECONDS (120s) so a ping always
// lands well before the previous one goes stale, even if one is dropped.
const PING_INTERVAL_MS = 15_000;

// Also report after this much movement regardless of the clock. A rider at 30 km/h covers 50 m in
// six seconds, so on the move this is what actually drives the update rate, and it is what makes
// the customer's marker glide rather than hop. Stationary at a light, the interval takes over and
// nothing is wasted.
const PING_DISTANCE_M = 50;

/**
 * Background tasks can be resumed by Android in a fresh JS context after the process was killed,
 * and the access token lives in memory only (see api/client.js), so it will not be there. The
 * refresh token is in SecureStore and does survive, so mint a new access token from it rather
 * than dropping the ping.
 *
 * This deliberately does not go through the client's response interceptor: with no access token
 * at all the server answers with a code that is not in its refreshable set, so the interceptor
 * would never fire and the ping would simply fail.
 */
async function ensureAccessToken() {
  if (getAccessToken()) return true;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const { data } = await axios.post(`${API_BASE}/api/partner/auth/refresh`, { refreshToken });
    setAccessToken(data.data.accessToken);
    return true;
  } catch {
    // Signed out, or the refresh token was revoked. Stop tracking rather than retrying forever
    // in the background against a session that no longer exists.
    await stopLocationPings();
    return false;
  }
}

async function report(coords) {
  if (!(await ensureAccessToken())) return;
  try {
    await client.post("/partner/location", {
      coordinates: [coords.longitude, coords.latitude],
      // A stationary fix reports heading as -1; the server normalises that away, but there is no
      // reason to send a value we already know is meaningless.
      ...(coords.heading != null && coords.heading >= 0 ? { heading: coords.heading } : {}),
      ...(coords.speed != null && coords.speed >= 0 ? { speed: coords.speed } : {}),
    });
  } catch {
    // Best-effort — a single failed ping (tunnel, request hiccup) isn't fatal; the next fix
    // tries again. Deliberately silent: this runs in the background many times an hour and
    // logging every blip would bury anything that matters.
  }
}

// Must be defined at module scope, not inside a function: Android resumes the task by looking up
// this name in a freshly-started JS context, so the registration has to happen as a side effect
// of the bundle loading rather than of any screen mounting.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  // Batched delivery is normal — Android holds fixes while dozing and hands over several at once.
  // Only the newest says where the rider is now, and the backend keeps no history, so the rest
  // would be writes that the very next line overwrites.
  await report(data.locations[data.locations.length - 1].coords);
});

// ─── Foreground-only fallback ──────────────────────────────────────────────
// Used when the partner grants "while using the app" but declines "all the time". Strictly worse
// — it still freezes on screen lock — but it keeps a partner who refused the broader permission
// visible to customers while they actually have the app open, instead of not tracking them at all.
let _watcher = null;

async function startForegroundWatch() {
  if (_watcher) return;
  _watcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: PING_INTERVAL_MS,
      distanceInterval: PING_DISTANCE_M,
    },
    ({ coords }) => report(coords),
  );
}

function stopForegroundWatch() {
  _watcher?.remove();
  _watcher = null;
}

/**
 * Starts reporting the partner's location. Safe to call repeatedly — a no-op if already running.
 *
 * Does nothing (rather than blocking the caller) when permission is refused: a partner without
 * location permission can still go online and receive offers, just without distance-based
 * priority in ranking (see the server's deliveryAssignment.service.js rankCandidates) and without
 * appearing on the customer's map.
 */
export async function startLocationPings() {
  // Every call site fires this without awaiting (the duty toggle, the duty-status hydrate, the
  // foreground-resume listener), so a rejection here would surface as an unhandled promise
  // rejection rather than as anything anyone can act on. Failing to start tracking must degrade
  // to "not tracked", never to a crash on the screen the rider uses to go online.
  try {
    await start();
  } catch {
    // Left silent for the same reason: this fires on every resume, and a device that refuses
    // background location will refuse it every single time.
  }
}

async function start() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") return;

  // Android requires foreground permission to already be granted before the background prompt is
  // allowed to appear, which is why these are sequential rather than concurrent.
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    await startForegroundWatch();
    return;
  }

  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  stopForegroundWatch();

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: PING_INTERVAL_MS,
    distanceInterval: PING_DISTANCE_M,
    // Android batches fixes aggressively while the screen is off to save battery. Left at its
    // default that can mean minutes of silence, which is exactly the freeze this file exists to
    // prevent, so hold it to roughly one interval.
    deferredUpdatesInterval: PING_INTERVAL_MS,
    // Keeps the process alive and, just as importantly, tells the rider plainly that their
    // location is being shared and how to stop it. Android 14+ refuses to start background
    // location without one.
    foregroundService: {
      notificationTitle: "You're online",
      notificationBody: "Sharing your location with customers on active deliveries.",
      notificationColor: "#FF5A00",
      // Deliberately false: if Android tears down the activity while the rider is mid-delivery,
      // the service — and the customer's live map — must survive it.
      killServiceOnDestroy: false,
    },
    // iOS only. Shows the blue status bar while tracking, which is the same honesty the Android
    // notification provides, and prevents iOS pausing updates when the rider stops moving —
    // "stopped at a red light" must not read as "tracking ended".
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });
}

/**
 * Stops all location reporting. Safe to call when nothing is running — which matters, because
 * sign-out calls it unconditionally (see context/PartnerAuthContext.jsx).
 */
export async function stopLocationPings() {
  stopForegroundWatch();

  // `unregisterTaskAsync` on a task that was never registered throws, so this has to be asked
  // rather than assumed.
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
}

// Exported for the Play Store listing work and for anyone auditing what the app declares.
export const BACKGROUND_LOCATION_TASK_NAME = LOCATION_TASK;
export const TRACKS_IN_BACKGROUND = Platform.OS !== "web";
