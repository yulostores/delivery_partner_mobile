import { Platform, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import Screen from "@/components/ui/Screen";
import AppBar from "@/components/partner/AppBar";
import PhotoCapture from "@/components/partner/PhotoCapture";
import { useOnboarding } from "@/context/OnboardingContext";
import client from "@/api/client";
import { DOCUMENT_FIELD_NAMES, DOCUMENT_TYPES } from "@/mocks/fixtures";

const GUIDELINES = [
  "Good lighting, avoid glare and shadows",
  "All four corners inside the frame",
  "Text sharp and readable",
];

// The server's per-file limit (yulo_backend middleware/uploadDocuments.js). Checked here first so a
// rider with a high-resolution camera gets a clear message instead of a failed upload.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
// Photos are re-encoded as JPEG at this quality, which keeps a document legible and well under the limit.
export const PHOTO_QUALITY = 0.5;

export async function uploadDocumentAsset(docType, asset) {
  if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
    throw new Error("This photo is larger than 5 MB. Please retake it, or choose a smaller image.");
  }
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

  const label = DOCUMENT_TYPES.find((d) => d.type === docType)?.label ?? "Document";

  async function upload(asset) {
    await uploadDocumentAsset(docType, asset);
    refreshOnboardingStatus();
    navigation.goBack();
  }

  return (
    <Screen>
      <AppBar title={`Upload · ${label}`} onBack />
      <PhotoCapture
        facing="back"
        frame={<View className="h-[158px] w-[250px] rounded-[14px] border-2 border-dashed border-primary" />}
        hint={`Align your ${label.toLowerCase()} within the frame`}
        guidelines={GUIDELINES}
        quality={PHOTO_QUALITY}
        subject={label.toLowerCase()}
        onUpload={upload}
      />
    </Screen>
  );
}
