import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { hereStyle } from "@/lib/here";

// The live map on the pickup/drop-off navigation screen (NavigationScreen.jsx).
// Split into .native/.web (see DeliveryMap.web.jsx) because
// @maplibre/maplibre-react-native has no web implementation at all — a plain
// `import` of it on web throws a fatal, uncaught exception the instant the
// module loads. Metro's platform-extension resolution means web never
// evaluates this file's imports in the first place.
//
// Watches the partner's own position independently of the 30s
// server-reporting loop in src/lib/locationPings.js, so the on-screen dot
// feels live even though the server only hears from it every 30s.
export default function DeliveryMap({ destination }) {
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
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
        ({ coords }) => setMyLocation([coords.longitude, coords.latitude]),
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  // Fit both pins in view once both are known; falls back to centering on
  // whichever one is available so the map never renders with an undefined
  // camera even before the first location fix comes in.
  useEffect(() => {
    if (destination && myLocation) {
      const lngs = [destination[0], myLocation[0]];
      const lats = [destination[1], myLocation[1]];
      cameraRef.current?.fitBounds(
        [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
        { padding: { top: 60, right: 60, bottom: 60, left: 60 }, duration: 500 },
      );
    }
  }, [destination, myLocation]);

  return (
    <Map style={{ flex: 1 }} mapStyle={hereStyle()}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: destination ?? myLocation ?? [77.5946, 12.9716],
          zoom: 13,
        }}
      />

      {myLocation && (
        <Marker lngLat={myLocation} anchor="center">
          <View className="size-4 rounded-full border-2 border-white bg-primary" />
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
