// Matches server/models/DeliveryPartner.js's document type enum exactly (was
// aadhar_card/pan_card/driving_license/bank_details/profile_photo — pan_card and bank_details
// aren't real uploadable document types on the backend at all; vehicle_rc and
// insurance_document were missing). fleetType is a real backend field now too (added once the
// backend phase started, per this file's now-stale original comment).
export const DOCUMENT_TYPES = [
  { type: "aadhar_card", label: "Aadhaar / Voter ID" },
  { type: "driving_license", label: "Driving licence" },
  { type: "vehicle_rc", label: "Vehicle RC" },
  { type: "insurance_document", label: "Insurance document" },
  { type: "profile_photo", label: "Selfie / live photo" },
];

// Multipart field name per document type — the backend's own reverse mapping
// (server/controllers/partner/onboarding.controller.js's DOCUMENT_FIELD_TYPES), needed when
// building the upload FormData.
export const DOCUMENT_FIELD_NAMES = {
  aadhar_card: "aadharCard",
  driving_license: "drivingLicense",
  vehicle_rc: "vehicleRc",
  insurance_document: "insuranceDocument",
  profile_photo: "profilePhoto",
};

// Values match server/models/DeliveryPartner.js's vehicle.type enum exactly (was
// 2w/ev_2w/non_rto_ev — none of which the backend accepts; submitting one would 400).
export const VEHICLE_TYPES = [
  { value: "2_wheeler", label: "2 Wheeler" },
  { value: "ev_2_wheeler", label: "EV 2 Wheeler" },
  { value: "non_rto_2_wheeler", label: "Non RTO EV" },
];

// "Salaried" removed — server/models/DeliveryPartner.js's bankDetails.accountType enum is only
// ['savings', 'current']; submitting "salaried" would 400. PAYMENT_PREFERENCES removed entirely
// (was below this) — there's no backend field for it at all (not paymentPreference, not any
// upiId-as-primary-method concept beyond upiId already being one of the plain bankDetails
// fields); inventing one client-side would just be silently discarded on submit.
export const ACCOUNT_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "current", label: "Current" },
];

export const SKIP_REASONS = [
  "Restaurant too far",
  "Drop location too far",
  "Too many active orders",
  "Taking a break",
  "Other",
];

