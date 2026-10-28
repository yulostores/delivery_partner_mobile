import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import Screen from "@/components/ui/Screen";
import AppBar from "@/components/partner/AppBar";
import PhotoCapture from "@/components/partner/PhotoCapture";
import { useOnboarding } from "@/context/OnboardingContext";
import { PHOTO_QUALITY, uploadDocumentAsset } from "@/screens/onboarding/DocumentCapture";

// Figma "22 – Selfie Capture" only calls for a single guideline row (vs. the
// three shown on "21 – Document Capture") — see node 464:1547.
const GUIDELINES = ["Good lighting, avoid glare and shadows"];

export default function SelfieCapture() {
  const navigation = useNavigation();
  const { refreshOnboardingStatus } = useOnboarding();

  async function upload(asset) {
    await uploadDocumentAsset("profile_photo", asset);
    refreshOnboardingStatus();
    navigation.goBack();
  }

  return (
    <Screen>
      <AppBar title="Upload · Your selfie" onBack />
      <PhotoCapture
        facing="front"
        frame={<View className="size-[220px] rounded-full border-2 border-dashed border-primary" />}
        hint="Align your face within the frame"
        guidelines={GUIDELINES}
        quality={PHOTO_QUALITY}
        subject="selfie"
        onUpload={upload}
      />
    </Screen>
  );
}
