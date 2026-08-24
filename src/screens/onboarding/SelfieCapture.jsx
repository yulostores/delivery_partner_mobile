import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { useOnboarding } from "@/context/OnboardingContext";
import { uploadDocumentAsset } from "@/screens/onboarding/DocumentCapture";

// Figma "22 – Selfie Capture" only calls for a single guideline row (vs. the
// three shown on "21 – Document Capture") — see node 464:1547.
const GUIDELINES = ["Good lighting, avoid glare and shadows"];

export default function SelfieCapture() {
  const navigation = useNavigation();
  const { refreshOnboardingStatus } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function complete(asset) {
    setBusy(true);
    setError(null);
    try {
      await uploadDocumentAsset("profile_photo", asset);
      refreshOnboardingStatus();
      navigation.goBack();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCapture() {
    setError(null);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setError("Camera permission is needed to capture your selfie.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled) await complete(result.assets[0]);
  }

  async function handlePickFromGallery() {
    setError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Photo library permission is needed to upload your selfie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) await complete(result.assets[0]);
  }

  return (
    <Screen>
      <AppBar title="Upload · Your selfie" onBack />

      <View className="w-full gap-4 px-6 pt-2">
        <View className="h-[392px] w-full items-center justify-center gap-[18px] rounded-[20px] bg-[#1a1a1a] p-6">
          <View className="size-[220px] rounded-full border-2 border-dashed border-primary" />
          <Text className="text-center font-jakarta-medium text-sm text-[#e8e2d9]">
            Align your face within the frame
          </Text>
        </View>

        <View className="w-full gap-2.5 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
          <Text className="font-jakarta-semibold text-base text-foreground">For a clear photo</Text>
          {GUIDELINES.map((g) => (
            <Text key={g} className="text-sm text-muted-foreground">
              ✅ {g}
            </Text>
          ))}
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <View className="gap-3 pt-2">
          <Button disabled={busy} onPress={handleCapture}>
            {busy ? "Uploading…" : "Capture photo"}
          </Button>
          <Button disabled={busy} onPress={handlePickFromGallery} variant="secondary" size="sm">
            Upload from gallery
          </Button>
        </View>
      </View>
    </Screen>
  );
}
