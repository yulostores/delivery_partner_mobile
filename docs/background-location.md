# Background location — how it works and what Google Play needs

Written for whoever fills in the Play Console data-safety and permissions forms, and for anyone
auditing what this app collects.

## What the app does

While a delivery partner is **on duty**, the app reports their position to the Yulo backend so the
customer waiting for that order can watch the rider approach on a live map.

- Reporting starts when the partner taps **Go online** (`handleToggleOnline` in
  `src/screens/home/Home.jsx`) and when the app rehydrates a partner who was already online.
- Reporting stops when the partner goes offline, and on sign-out
  (`stopLocationPings` in `src/context/PartnerAuthContext.jsx`).
- While reporting, Android shows a permanent foreground-service notification reading
  **"You're online — Sharing your location with customers on active deliveries."**
- The implementation is `src/lib/locationPings.js`, task name `yulo-partner-location`.

Location is **never** collected from a partner who is offline, signed out, or who has not granted
the permission.

## Why background access is required, not just foreground

A rider is riding. Their phone is in a pocket, a mount, or has a locked screen for essentially the
entire delivery. Android freezes JavaScript timers and suspends foreground-only location for a
backgrounded app within seconds, so foreground-only access would deliver a position for the few
moments the rider is actively looking at the screen and nothing for the rest of the trip.

The customer-facing consequence is concrete: the backend treats a position older than 120 seconds
as stale (`LOCATION_FRESHNESS_SECONDS` in the server's `geo.service.js`). With foreground-only
access the rider's marker on the customer's tracking screen freezes and then vanishes, and the
arrival estimate disappears with it — the core feature stops working precisely when it matters.

## What to enter in Play Console

**Permissions declaration → `ACCESS_BACKGROUND_LOCATION`**

> Core functionality: live delivery tracking.
>
> Yulo Delivery Partner is used by delivery riders. While a rider is on duty, the app reports their
> location to our server so the customer awaiting that order can see the rider's position and an
> accurate arrival time on a live map. Riders have the app backgrounded or the screen locked for
> the entire delivery, so foreground-only location would not produce the continuous updates this
> feature requires. Location access begins only when the rider explicitly taps "Go online", runs
> under a persistent foreground-service notification for its whole duration, and stops immediately
> when the rider goes offline or signs out.

**Runtime environment:** the app requests foreground location first, and only then prompts for
background access. A rider who declines background access can still work; the app falls back to
foreground-only updates and the rider simply is not visible to customers while the app is not
open.

**Data safety form**

| Field | Answer |
| --- | --- |
| Data type | Location → Approximate location, Precise location |
| Collected | Yes |
| Shared with third parties | No |
| Processed ephemerally | **Yes** — only the latest position is stored; see below |
| Required or optional | Optional (the app works without it, with reduced functionality) |
| Purpose | App functionality |
| Encrypted in transit | Yes (HTTPS) |
| Can the user request deletion | Yes — going offline stops collection; account deletion removes the stored field |

The "processed ephemerally" answer is accurate and worth not overstating: the backend keeps only
the single most recent position on the partner document (`DeliveryPartner.currentLocation` plus
`currentLocationUpdatedAt`) and overwrites it on each ping. There is no location-history
collection anywhere in the platform, and the live socket broadcast is not persisted.

## Demo video for review

Google requires a video showing the feature in use. Record, in one unbroken take:

1. The rider signing in and the home screen showing **Offline**.
2. Tapping **Go online** — show the foreground and then the background permission prompts, and the
   notification appearing.
3. The notification visible in the shade while the app is backgrounded.
4. A customer device on the order-tracking screen, with the rider marker moving.
5. Returning to the partner app and tapping **Go offline** — show the notification disappearing.

Step 4 is the one reviewers look for: it demonstrates that background location serves a
user-visible feature rather than analytics.

## Things that will fail review

- Removing or silencing the foreground-service notification. Android 14+ also refuses to start the
  service without one.
- Starting location updates anywhere other than the on-duty toggle.
- Collecting location while the partner is offline.
- Adding a location-history store without revisiting the "processed ephemerally" answer above.
