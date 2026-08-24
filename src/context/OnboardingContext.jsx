import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import client from "@/api/client";
import { DOCUMENT_TYPES } from "@/mocks/fixtures";
import { usePartnerAuth } from "@/context/PartnerAuthContext";

const OnboardingContext = createContext(null);

export const ONBOARDING_STATUS_KEY = ["partner", "onboarding", "status"];
export const TRAINING_STATUS_KEY = ["partner", "training", "status"];

// Document upload progress + verification status now come from the real backend
// (GET /api/partner/onboarding/status) instead of local state. `training` (Step 8) does too now,
// from GET /api/partner/training/status.
export function OnboardingProvider({ children }) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = usePartnerAuth();

  // OnboardingProvider wraps the whole onboarding stack (see RootNavigator.jsx), including
  // PhoneEntry/OtpVerification, which render before login — without this gate, the query fires
  // with no access token yet and the backend correctly 401s ("No token provided").
  const { data, isError: onboardingStatusError } = useQuery({
    queryKey: ONBOARDING_STATUS_KEY,
    queryFn: () => client.get("/partner/onboarding/status"),
    enabled: isAuthenticated,
  });

  // Reshaped to the same {[type]: "uploaded"} map DocumentUploadHub.jsx already consumes, derived
  // from the real documents array — keeps that screen's existing rendering logic working
  // unchanged even though the underlying data source is now real.
  const documents = Object.fromEntries((data?.documents ?? []).map((d) => [d.type, "uploaded"]));
  const verificationStatus = data?.verificationStatus ?? "pending_documents";
  const verificationNotes = data?.verificationNotes ?? null;

  const uploadedCount = Object.keys(documents).length;
  const nextDocType = DOCUMENT_TYPES.find((d) => documents[d.type] !== "uploaded")?.type ?? null;

  // Called after a real document upload succeeds (DocumentCapture.jsx/SelfieCapture.jsx) so
  // `documents` reflects the just-uploaded file instead of a locally-set flag.
  const refreshOnboardingStatus = () => queryClient.invalidateQueries({ queryKey: ONBOARDING_STATUS_KEY });

  // Training is only reachable once approved, and the backend enforces that with its own 403
  // (training.controller.js's assertApprovedForTraining) — gating the fetch on verificationStatus
  // avoids hitting a guaranteed 403 on every other onboarding screen for a partner who isn't
  // there yet.
  const { data: training, isError: trainingError } = useQuery({
    queryKey: TRAINING_STATUS_KEY,
    queryFn: () => client.get("/partner/training/status"),
    enabled: verificationStatus === "approved",
  });

  const refreshTrainingStatus = () => queryClient.invalidateQueries({ queryKey: TRAINING_STATUS_KEY });

  return (
    <OnboardingContext.Provider
      value={{
        documents,
        uploadedCount,
        totalDocuments: DOCUMENT_TYPES.length,
        nextDocType,
        verificationStatus,
        verificationNotes,
        onboardingStatusError,
        refreshOnboardingStatus,
        training,
        trainingError,
        refreshTrainingStatus,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be inside OnboardingProvider");
  return ctx;
}
