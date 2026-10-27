import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { usePartnerAuth } from "@/context/PartnerAuthContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import PlaceholderScreen from "@/components/partner/PlaceholderScreen";
import BottomNav from "@/components/partner/BottomNav";
import { MAIN } from "@/navigation/tabs";

import PhoneEntry from "@/screens/onboarding/PhoneEntry";
import OtpVerification from "@/screens/onboarding/OtpVerification";
import PersonalInformation from "@/screens/onboarding/PersonalInformation";
import DocumentUploadHub from "@/screens/onboarding/DocumentUploadHub";
import DocumentCapture from "@/screens/onboarding/DocumentCapture";
import VehicleDetailsForm from "@/screens/onboarding/VehicleDetailsForm";
import BankPaymentDetails from "@/screens/onboarding/BankPaymentDetails";
import VerificationStatus from "@/screens/onboarding/VerificationStatus";
import TrainingModule from "@/screens/onboarding/TrainingModule";
import TrainingComplete from "@/screens/onboarding/TrainingComplete";
import Home from "@/screens/home/Home";
import FleetBadgeInfo from "@/screens/home/FleetBadgeInfo";
import OrdersTab from "@/screens/orders/OrdersTab";
import IncomingOrder from "@/screens/orders/IncomingOrder";
import RejectReasonSheet from "@/screens/orders/RejectReasonSheet";
import SkipConfirmed from "@/screens/orders/SkipConfirmed";
import GoToPickup from "@/screens/delivery/GoToPickup";
import VegCheckpoint from "@/screens/delivery/VegCheckpoint";
import NavigateToCustomer from "@/screens/delivery/NavigateToCustomer";
import CodCollection from "@/screens/delivery/CodCollection";
import PaymentReceived from "@/screens/delivery/PaymentReceived";
import DeliverySummary from "@/screens/delivery/DeliverySummary";
import Earnings from "@/screens/earnings/Earnings";
import CashDeposit from "@/screens/earnings/CashDeposit";
import DepositConfirmed from "@/screens/earnings/DepositConfirmed";
import SelfieCapture from "@/screens/onboarding/SelfieCapture";
import Profile from "@/screens/profile/Profile";
import PersonalDetails from "@/screens/profile/PersonalDetails";
import VehicleDetails from "@/screens/profile/VehicleDetails";
import DocumentsUploaded from "@/screens/profile/DocumentsUploaded";
import SupportHelp from "@/screens/profile/SupportHelp";
import Notifications from "@/screens/profile/Notifications";
import FleetChangeRequest from "@/screens/profile/FleetChangeRequest";
import RequestSubmitted from "@/screens/profile/RequestSubmitted";
import ReportIssue from "@/screens/profile/ReportIssue";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Flat stack mirroring the flow-by-flow screen inventory from the plan doc —
// every one of the 32 screens gets a route from day one (real or stub) so
// in-app navigation never dead-ends while the remaining flows are built out.
const STUBS = [
  { name: "ProfileSettings", title: "App Settings", flow: "Flow 6 — Profile & Account" },

  { name: "EdgeFleetDecision", title: "Customer Fleet Decision Prompt", flow: "Flow 7 — Edge Cases", showNav: false },
  { name: "EdgeVegViolation", title: "Veg Violation Detected", flow: "Flow 7 — Edge Cases", showNav: false },
];

function OnboardingStack() {
  return (
    <OnboardingProvider>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="OnboardingPhoneEntry" component={PhoneEntry} />
        <Stack.Screen name="OnboardingOtp" component={OtpVerification} />
        <Stack.Screen name="OnboardingPersonalInfo" component={PersonalInformation} />
        <Stack.Screen name="OnboardingDocuments" component={DocumentUploadHub} />
        <Stack.Screen name="OnboardingDocumentCapture" component={DocumentCapture} />
        <Stack.Screen name="SelfieCapture" component={SelfieCapture} />
        <Stack.Screen name="OnboardingVehicleDetails" component={VehicleDetailsForm} />
        <Stack.Screen name="OnboardingBankDetails" component={BankPaymentDetails} />
        <Stack.Screen name="OnboardingStatus" component={VerificationStatus} />
        <Stack.Screen name="OnboardingTraining" component={TrainingModule} />
        <Stack.Screen name="OnboardingTrainingComplete" component={TrainingComplete} />
      </Stack.Navigator>
    </OnboardingProvider>
  );
}

// Home / Orders / Earn / Profile: a real tab navigator. Switching tabs keeps each screen mounted
// and just shows another one — no native push, no transition, nothing to reset. They used to be
// root-stack screens, and quick switching between them could leave the native stack
// mid-transition with every touch blocked until the app was restarted (see BottomNav.jsx).
// Hardware Back from another tab returns to Home, then leaves the app.
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeOffline"
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomNav state={props.state} navigation={props.navigation} />}
    >
      <Tab.Screen name="HomeOffline" component={Home} />
      <Tab.Screen name="OrdersTab" component={OrdersTab} />
      <Tab.Screen name="Earnings" component={Earnings} initialParams={{ period: "today" }} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  // No auth-aware routing existed here at all before this — initialRouteName was hardcoded to
  // "Onboarding" unconditionally, so even a fully persisted, still-valid session would land back
  // on PhoneEntry on every app launch. `hydrated`/`isAuthenticated` come from
  // PartnerAuthContext's own AsyncStorage/refresh-token hydration (see PartnerAuthContext.jsx).
  // Landing an authenticated-but-not-yet-approved partner on Home is a reasonable default, not a
  // perfect one — resuming at the exact right onboarding step (personal info vs. documents vs.
  // awaiting verification) needs the onboarding-status data that only gets wired in once the
  // onboarding screens themselves are (a later step), not something to build here.
  const { hydrated, isAuthenticated } = usePartnerAuth();

  if (!hydrated) return null;

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={isAuthenticated ? MAIN : "Onboarding"}
    >
      <Stack.Screen name="Onboarding" component={OnboardingStack} />
      {/* The tabs, once. Everything else opens on top of it; goToTab() (navigation/tabs.js) pops
          back down to it, so "Done" / "Back to home" never stacks a second copy. */}
      <Stack.Screen name={MAIN} component={MainTabs} />
      <Stack.Screen
        name="FleetBadgeInfo"
        component={FleetBadgeInfo}
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      {/* A single route now — fleetType comes from the real order_offer payload (see
          partnerSocket.js), not from which of two routes got registered. */}
      {/* One screen per OFFER (order id + when that offer lapses): a new offer — including the
          same order offered again after a cooldown — opens fresh with its own countdown, instead
          of reviving an earlier screen whose countdown already ran out and which no longer
          accepts taps. The same offer opened again (resume, notification tap) returns to its
          existing screen. */}
      <Stack.Screen
        name="OrdersIncoming"
        component={IncomingOrder}
        getId={({ params }) =>
          params?.orderId ? `${params.orderId}:${params.offerExpiresAt ?? ""}` : undefined
        }
      />
      <Stack.Screen
        name="OrdersReject"
        component={RejectReasonSheet}
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <Stack.Screen name="OrdersSkipConfirmed" component={SkipConfirmed} />
      <Stack.Screen name="DeliveryPickup" component={GoToPickup} />
      <Stack.Screen name="DeliveryVegCheckpoint" component={VegCheckpoint} />
      <Stack.Screen name="DeliveryNavigate" component={NavigateToCustomer} />
      <Stack.Screen name="DeliveryCodCollection" component={CodCollection} />
      <Stack.Screen name="DeliveryPaymentReceived" component={PaymentReceived} />
      <Stack.Screen name="DeliverySummary" component={DeliverySummary} />
      <Stack.Screen name="EarningsCashDeposit" component={CashDeposit} />
      {/* Was imported but never registered — CashDeposit.jsx's navigate("EarningsDepositConfirmed")
          targeted a route that didn't exist at all. */}
      <Stack.Screen name="EarningsDepositConfirmed" component={DepositConfirmed} />
      <Stack.Screen name="ProfilePersonalDetails" component={PersonalDetails} />
      <Stack.Screen name="ProfileVehicleDetails" component={VehicleDetails} />
      <Stack.Screen name="ProfileDocuments" component={DocumentsUploaded} />
      <Stack.Screen name="ProfileHelpSupport" component={SupportHelp} />
      <Stack.Screen name="ProfileNotifications" component={Notifications} />
      <Stack.Screen name="ProfileFleetChange" component={FleetChangeRequest} />
      <Stack.Screen name="ProfileFleetChangeSubmitted" component={RequestSubmitted} />
      <Stack.Screen name="ProfileReportIssue" component={ReportIssue} />
      {STUBS.map(({ name, title, flow, showNav }) => (
        <Stack.Screen key={name} name={name}>
          {() => <PlaceholderScreen title={title} flow={flow} showNav={showNav ?? true} />}
        </Stack.Screen>
      ))}
    </Stack.Navigator>
  );
}
