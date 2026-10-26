import AsyncStorage from "@react-native-async-storage/async-storage";

// When the rider went on duty, kept on the phone so Home's "duty time" survives the app being
// backgrounded (JS timers freeze) or killed and reopened. The server's duty status says only
// whether the rider is on duty, not since when, so a shift already running when this phone first
// sees it is timed from that moment.
const DUTY_START_KEY = "yulo_partner_duty_started_at";

/** The stored start (ms), or `fallback` — which is then stored, so later reads agree with it. */
export async function getOrStartDuty(fallback = Date.now()) {
  try {
    const stored = Number(await AsyncStorage.getItem(DUTY_START_KEY));
    if (Number.isFinite(stored) && stored > 0 && stored <= Date.now()) return stored;
    await AsyncStorage.setItem(DUTY_START_KEY, String(fallback));
  } catch {
    // Storage unavailable — the clock just runs from now.
  }
  return fallback;
}

export async function clearDutyStart() {
  try {
    await AsyncStorage.removeItem(DUTY_START_KEY);
  } catch {
    // nothing stored
  }
}
