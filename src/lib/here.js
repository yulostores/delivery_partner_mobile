// here.js — HERE Location Services configuration for the map layer.
//
// The app renders maps with MapLibre (`@maplibre/maplibre-react-native`, a
// Google-free native map renderer — no Play Services dependency on Android,
// unlike react-native-maps) and points it at HERE's Raster Tile API v3 for
// the actual imagery. `hereStyle()` builds the minimal MapLibre style JSON a
// <Map> needs; see src/screens/delivery/NavigationScreen.jsx for where it's
// consumed.
//
// The key is a plain EXPO_PUBLIC_ var (same convention as API_BASE in
// src/api/config.js) — inlined into the JS bundle, not a hidden server
// secret. A client-side map key has to ship inside the app to work at all;
// its safety comes from restricting it (referrer/IP allow-list) on the HERE
// developer portal, not from keeping it out of the repo.

export const HERE_API_KEY = process.env.EXPO_PUBLIC_HERE_API_KEY ?? "";

// HERE Raster Tile API v3 — plain {z}/{x}/{y} PNG tiles, so any generic map
// renderer that supports a raster tile URL template can use them:
// https://developer.here.com/documentation/raster-tile-api/api-reference.html
function hereTileUrlTemplate() {
  return `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?style=explore.day&apiKey=${HERE_API_KEY}`;
}

// The minimal MapLibre style object a <Map mapStyle={...}> needs to render
// HERE tiles as its only layer.
//
// Built once and cached, not reconstructed per call: HERE_API_KEY never
// changes at runtime, so every caller can safely share one object —
// DeliveryMap.native.jsx calls this on every render, including every ~4s
// live-location update, which would otherwise rebuild and re-stringify an
// identical style for no reason.
let cachedStyle = null;

export function hereStyle() {
  if (!cachedStyle) {
    cachedStyle = {
      version: 8,
      sources: {
        here: {
          type: "raster",
          tiles: [hereTileUrlTemplate()],
          tileSize: 256,
          attribution: "© HERE",
        },
      },
      layers: [{ id: "here-base", type: "raster", source: "here" }],
    };
  }
  return cachedStyle;
}
