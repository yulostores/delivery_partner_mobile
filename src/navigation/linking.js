// URL-based navigation for the React Navigation stack. Two things this
// unlocks: (1) shareable/bookmarkable URLs on the Expo web target — useful
// for testing and for the eventual admin/support tooling — and (2) the
// eventual seam for native deep links (e.g. tapping a push notification for
// a new order should jump straight to OrdersIncoming). `prefixes` is left
// empty since no native URL scheme is configured yet in app.json — add one
// there (`"scheme": "..."`) before wiring real push-notification deep links.
export const linking = {
  prefixes: [],
  config: {
    screens: {
      Onboarding: {
        screens: {
          OnboardingPhoneEntry: "onboarding/phone",
          OnboardingOtp: "onboarding/otp",
          OnboardingPersonalInfo: "onboarding/personal-info",
          OnboardingDocuments: "onboarding/documents",
          OnboardingDocumentCapture: "onboarding/documents/:docType/capture",
          SelfieCapture: "onboarding/documents/selfie/capture",
          OnboardingVehicleDetails: "onboarding/vehicle-details",
          OnboardingBankDetails: "onboarding/bank-details",
          OnboardingStatus: "onboarding/status",
          // No :moduleId param anymore (Step 8) — TrainingModule.jsx derives its current module
          // from GET /partner/training/status (server-tracked), and TrainingComplete.jsx takes a
          // rich object of just-completed-module details as a route param, neither of which is
          // meaningfully URL-encodable.
          OnboardingTraining: "onboarding/training",
          OnboardingTrainingComplete: "onboarding/training/complete",
        },
      },
      HomeOffline: "home",
      FleetBadgeInfo: "home/fleet-badge",
      OrdersIncoming: "orders/incoming",
      OrdersReject: "orders/incoming/reject",
      OrdersSkipConfirmed: "orders/skip-confirmed",
      // No :orderKey param anymore (Step 6) — these screens now receive a full real order object
      // as a route param, which isn't meaningfully URL-encodable, so a bare path is all these are.
      // Deep-linking directly into an in-progress delivery isn't a supported flow via URL.
      DeliveryPickup: "delivery/pickup",
      DeliveryVegCheckpoint: "delivery/veg-checkpoint",
      DeliveryNavigate: "delivery/navigate",
      DeliveryCodCollection: "delivery/cod-collection",
      DeliveryPaymentReceived: "delivery/payment-received",
      DeliverySummary: "delivery/summary",
      Earnings: "earnings",
      EarningsWeekly: "earnings/weekly",
      EarningsMonthly: "earnings/monthly",
      EarningsCashDeposit: "earnings/cash-deposit",
      Profile: "profile",
      ProfilePersonalDetails: "profile/personal-details",
      ProfileVehicleDetails: "profile/vehicle-details",
      ProfileDocuments: "profile/documents",
      ProfileHelpSupport: "profile/help-support",
      ProfileNotifications: "profile/notifications",
      ProfileSettings: "profile/settings",
      ProfileFleetChange: "profile/fleet-change",
      ProfileFleetChangeSubmitted: "profile/fleet-change/submitted",
      ProfileReportIssue: "profile/support/report-issue",
      EdgeFleetDecision: "edge/fleet-decision",
      EdgeVegViolation: "edge/veg-violation",
    },
  },
};
