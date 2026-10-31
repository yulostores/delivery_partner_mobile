import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { hereStyle } from "@/lib/here";

// The live map on the pickup/drop-off navigation screen (NavigationScreen.jsx). Loaded only through
// DeliveryMap.native.jsx, once MapLibre's native code is confirmed in the binary — never import it directly.
// Split into .native/.web (see DeliveryMap.web.jsx) because
// @maplibre/maplibre-react-native has no web implementation at all — a plain
// `import` of it on web throws a fatal, uncaught exception the instant the
// module loads. Metro's platform-extension resolution means web never
// evaluates this file's imports in the first place.
//
// Watches the partner's own position independently of the server-reporting
// loop in src/lib/locationPings.js (every 15s or 50 m), so the on-screen dot
// moves every few seconds.
// `pickup` (optional) adds the restaurant as a second pin — the order offer screen shows the whole
// trip (rider → restaurant → customer) so the rider can judge it before accepting.
export default function DeliveryMap({ destination, pickup }) {
  const cameraRef = useRef(null);
  const [myLocation, setMyLocation] = useState(null);

  useEffect(() => {
    let subscription;
    let cancelled = false;

    (async () => {
      // Permission was already requested (and, if denied, already accepted as
      // a no-op) when the partner went online — see locationPings.js — so
      // this only ever silently does nothing extra on top of that, never
      // prompts a second time.
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted" || cancelled) return;
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
        ({ coords }) => {
          if (!cancelled) setMyLocation([coords.longitude, coords.latitude]);
        },
      );
      // Left the screen while the watch was starting: stop it now, or it runs on (GPS on,
      // updating a map that no longer exists) until the app is killed.
      if (cancelled) watcher.remove();
      else subscription = watcher;
    })().catch(() => {});

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  // No destination (Home's map): centre on the rider once, when the first fix arrives —
  // initialViewState only applies on mount, before any fix exists. Only once, so the rider can
  // pan around without the map snapping back every few seconds.
  const centredOnMeRef = useRef(false);
  useEffect(() => {
    if (destination || pickup || !myLocation || centredOnMeRef.current) return;
    centredOnMeRef.current = true;
    cameraRef.current?.easeTo({ center: myLocation, zoom: 14, duration: 500 });
  }, [destination, pickup, myLocation]);

  // Fit both pins in view once both are known; falls back to centering on
  // whichever one is available so the map never renders with an undefined
  // camera even before the first location fix comes in.
  // With a pickup too, all three (rider, restaurant, customer) — or just the two pins until the
  // rider's own fix arrives.
  useEffect(() => {
    const points = [pickup, destination, myLocation].filter(Boolean);
    if (!destination || points.length < 2) return;
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      { padding: { top: 60, right: 60, bottom: 60, left: 60 }, duration: 500 },
    );
  }, [destination, pickup, myLocation]);

  return (
    <Map style={{ flex: 1 }} mapStyle={hereStyle()}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: pickup ?? destination ?? myLocation ?? [77.5946, 12.9716],
          zoom: 13,
        }}
      />

      {myLocation && (
        <Marker lngLat={myLocation} anchor="center">
          <View className="size-4 rounded-full border-2 border-white bg-primary" />
        </Marker>
      )}

      {pickup && (
        <Marker lngLat={pickup} anchor="center">
          <View className="size-5 items-center justify-center rounded-full border-2 border-white bg-primary">
            <View className="size-1.5 rounded-full bg-white" />
          </View>
        </Marker>
      )}

      {destination && (
        <Marker lngLat={destination} anchor="bottom">
          <View className="size-4 rounded-full bg-success" />
        </Marker>
      )}
    </Map>
  );
}
