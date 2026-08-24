import { useState } from "react";
import { Platform, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import Button from "@/components/ui/Button";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import { useOnboarding } from "@/context/OnboardingContext";
import client from "@/api/client";
import { DOCUMENT_FIELD_NAMES, DOCUMENT_TYPES } from "@/mocks/fixtures";

const GUIDELINES = [
  "Good lighting, avoid glare and shadows",
  "All four corners inside the frame",
  "Text sharp and readable",
];

export async function uploadDocumentAsset(docType, asset) {
  const fieldName = DOCUMENT_FIELD_NAMES[docType];
  const form = new FormData();

  if (Platform.OS === "web") {
    const blob = await fetch(asset.uri).then((r) => r.blob());
    form.append(fieldName, blob, asset.fileName || `${docType}.jpg`);
  } else {
    form.append(fieldName, {
      uri: asset.uri,
      name: asset.fileName || `${docType}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  }

  // Don't set Content-Type manually — axios/the runtime needs to generate its own multipart
  // boundary, and a hardcoded header without one breaks multer parsing on the backend.
  await client.post("/partner/onboarding/documents", form);
}

export default function DocumentCapture() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { docType } = params;
  const { refreshOnboardingStatus } = useOnboarding();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const label = DOCUMENT_TYPES.find((d) => d.type === docType)?.label ?? "Document";

  async function complete(asset) {
    setBusy(true);
    setError(null);
    try {
      await uploadDocumentAsset(docType, asset);
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
      setError("Camera permission is needed to capture your document.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) await complete(result.assets[0]);
  }

  async function handlePickFromGallery() {
    setError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Photo library permission is needed to upload your document.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) await complete(result.assets[0]);
  }

  return (
    <Screen>
      <AppBar title={`Upload · ${label}`} onBack />

      <View className="w-full gap-4 px-6 pt-2">
        <View className="h-[392px] w-full items-center justify-center gap-[18px] rounded-[20px] bg-[#1a1a1a] p-6">
          <View className="h-[158px] w-[250px] rounded-[14px] border-2 border-dashed border-primary" />
          <Text className="text-center font-jakarta-medium text-sm text-[#e8e2d9]">
            Align your {label.toLowerCase()} within the frame
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
