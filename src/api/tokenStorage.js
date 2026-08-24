import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Unlike the access token (memory-only, see client.js), the refresh token needs to survive an
// app restart — that's the whole point of a refresh token. SecureStore wraps the iOS
// Keychain/Android Keystore, appropriate for a long-lived credential in a way AsyncStorage
// (already used elsewhere in this app for the non-sensitive cached profile) isn't.
const REFRESH_TOKEN_KEY = "yulo_partner_refresh_token";

// expo-secure-store's web target has no real implementation at all — its web module is a literal
// empty stub (node_modules/expo-secure-store/src/ExpoSecureStore.web.ts just exports {}), since
// there's no browser equivalent of a Keychain/Keystore to wrap. This app's real targets are
// iOS/Android, where SecureStore is used unconditionally below and this branch never runs. The
// localStorage fallback exists only so testing via `expo start --web` (used here for lack of an
// available mobile simulator/device) doesn't hard-crash on every authenticated screen — confirmed
// this is genuinely a platform gap, not a bug, by reading the stub source directly.
const isWeb = Platform.OS === "web";

export async function getRefreshToken() {
  if (isWeb) return globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token) {
  if (isWeb) return void globalThis.localStorage?.setItem(REFRESH_TOKEN_KEY, token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearRefreshToken() {
  if (isWeb) return void globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
