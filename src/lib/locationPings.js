import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import client, { getAccessToken, refreshAccessToken } from "@/api/client";

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

// No movement threshold. expo-location's distanceInterval means "only when the location has
// changed by at least this distance" — a floor on top of the interval, not an alternative to it.
// At 50 m a rider waiting at the restaurant or for their next order sent nothing at all, the
// server marked their position stale after 120 s, and offers lost their pickup distance and the
// rider their distance priority. With 0 the interval alone drives updates, moving or not.
const PING_DISTANCE_M = 0;

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

  let token;
  try {
    token = await refreshAccessToken();
  } catch {
    // Offline for a moment — skip this ping, keep tracking. (Stopping here used to end tracking
    // for the rest of the shift on one dropped connection.)
    return false;
  }
  if (!token) {
    // Signed out, or the refresh token was revoked. Stop tracking rather than retrying forever
    // in the background against a session that no longer exists.
    await stopLocationPings();
    return false;
  }
  return true;
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
// Also what the web build uses: a browser has no background task, and its watch fires only when
// the position changes — so the last fix is re-sent on the interval while it is running, or a
// rider standing still would go stale exactly as above.
let _watcher = null;
let _heartbeat = null;
let _lastCoords = null;
let _lastReportAt = 0;

function reportFromWatch(coords) {
  _lastCoords = coords;
  _lastReportAt = Date.now();
  return report(coords);
}

async function startForegroundWatch() {
  if (_watcher) return;
  _watcher = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: PING_INTERVAL_MS,
      distanceInterval: PING_DISTANCE_M,
    },
    ({ coords }) => reportFromWatch(coords),
  );
  // Checked more often than the interval, so timer jitter can't stretch a gap to two intervals.
  _heartbeat = setInterval(() => {
    if (_lastCoords && Date.now() - _lastReportAt >= PING_INTERVAL_MS) reportFromWatch(_lastCoords);
  }, PING_INTERVAL_MS / 3);
}

function stopForegroundWatch() {
  _watcher?.remove();
  _watcher = null;
  if (_heartbeat) clearInterval(_heartbeat);
  _heartbeat = null;
  _lastCoords = null;
}

/**
 * Starts reporting the partner's location. Safe to call repeatedly — a no-op if already running.
 *
 * Does nothing (rather than blocking the caller) when permission is refused: a partner without
 * location permission can still go online and receive offers, just without distance-based
 * priority in ranking (see the server's deliveryAssignment.service.js rankCandidates) and without
 * appearing on the customer's map.
 */
// Calls run one at a time: going online (which asks) and a return to the foreground (which only
// checks) often overlap, and two concurrent starts could each see "nothing running" and start
// two watchers — double the GPS use and double the pings.
let _startChain = Promise.resolve();

// No queued step may hold the queue forever — some phones never return from the "Allow all the
// time" settings page with an answer, and everything behind it (going offline, signing out) would
// wait on it. The step itself carries on; the queue just stops waiting for it.
const STEP_LIMIT_MS = 2 * 60 * 1000;
const bounded = (fn) => () =>
  Promise.race([fn(), new Promise((resolve) => setTimeout(resolve, STEP_LIMIT_MS))]);

export function startLocationPings(options) {
  const run = bounded(() => startOnce(options));
  _startChain = _startChain.then(run, run);
  return _startChain;
}

async function startOnce({ ask = false } = {}) {
  // Every call site fires this without awaiting (the duty toggle, the duty-status hydrate, the
  // foreground-resume listener), so a rejection here would surface as an unhandled promise
  // rejection rather than as anything anyone can act on. Failing to start tracking must degrade
  // to "not tracked", never to a crash on the screen the rider uses to go online.
  try {
    await start(ask);
  } catch {
    // Left silent for the same reason: this fires on every resume, and a device that refuses
    // background location will refuse it every single time.
  }
}

// `ask` shows the permission prompts — only when the rider has just tapped "Go online". Every
// other caller (launch, return to the foreground) only checks. Asking on return to the
// foreground was a loop: the prompt (or Android's "Allow all the time" settings page) sends the
// app to the background, closing it brings the app back, which asked again — the screen and the
// status bar flickered until Android stopped showing the prompt.
async function start(ask) {
  const foreground = ask
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") return;

  // The web build has no background location task — startLocationUpdatesAsync doesn't exist
  // there, and the error it threw was swallowed by startOnce, so a rider on web never sent a
  // single ping. The browser watch is what web can do.
  if (!TRACKS_IN_BACKGROUND) {
    await startForegroundWatch();
    return;
  }

  // Android requires foreground permission to already be granted before the background prompt is
  // allowed to appear, which is why these are sequential rather than concurrent.
  const background = ask
    ? await Location.requestBackgroundPermissionsAsync()
    : await Location.getBackgroundPermissionsAsync();
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
export function stopLocationPings() {
  // Queued behind any start still in progress — otherwise going offline straight after going
  // online could stop "nothing" and then have the pending start switch tracking on.
  const run = bounded(stopNow);
  _startChain = _startChain.then(run, run);
  return _startChain;
}

async function stopNow() {
  try {
    stopForegroundWatch();
  } catch {
    // already gone
  }

  // `unregisterTaskAsync` on a task that was never registered throws, so this has to be asked
  // rather than assumed.
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
}

// Exported for the Play Store listing work and for anyone auditing what the app declares.
export const BACKGROUND_LOCATION_TASK_NAME = LOCATION_TASK;
export const TRACKS_IN_BACKGROUND = Platform.OS !== "web";
