import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

import Button from "@/components/ui/Button";
import Text from "@/components/ui/Text";

// The shared body of the document and selfie upload screens: a live camera preview inside the
// app (expo-camera) with the alignment frame drawn over it, a shutter, a review step (Retake /
// Use photo), and "Upload from gallery" as the alternative.
//
// This used to be a static dark box with a dashed outline, and "Capture photo" handed off to the
// phone's own camera app — riders saw a black rectangle where they expected a viewfinder.
//
// The preview only runs while the screen is focused, so the camera is released as soon as the
// rider moves on (or another screen is pushed on top).
export default function PhotoCapture({
  facing = "back",
  frame,
  hint,
  guidelines,
  quality,
  subject,
  onUpload,
}) {
  const focused = useIsFocused();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState(null); // { uri, width, height } awaiting "Use photo"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // First visit: ask straight away, so the camera simply opens. After a "Deny", the rider asks
  // again with the button below (or goes to Settings once Android stops asking).
  useEffect(() => {
    if (permission?.status === "undetermined") requestPermission();
  }, [permission?.status, requestPermission]);

  // The preview unmounts when the screen loses focus or a photo is under review; it reports
  // ready again once it is back.
  useEffect(() => {
    if (!focused) setCameraReady(false);
  }, [focused]);

  const granted = permission?.granted === true;
  // Denied for good ("Don't ask again"): asking again does nothing, only Settings can change it.
  const blocked = permission && !permission.granted && !permission.canAskAgain;

  async function upload(asset) {
    setBusy(true);
    setError(null);
    try {
      await onUpload(asset);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    if (!cameraRef.current || !cameraReady || busy) return;
    setError(null);
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality });
      setCameraReady(false);
      setPhoto(shot);
    } catch {
      setError("Couldn't take the photo. Please try again.");
    }
  }

  async function pickFromGallery() {
    setError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError(`Photo library permission is needed to upload your ${subject}.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality });
    if (!result.canceled) await upload(result.assets[0]);
  }

  let viewfinder;
  if (photo) {
    viewfinder = <Image source={{ uri: photo.uri }} className="h-full w-full" resizeMode="cover" />;
  } else if (granted && focused) {
    viewfinder = (
      <>
        <CameraView
          ref={cameraRef}
          facing={facing}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => setError("The camera couldn't start. You can upload from the gallery instead.")}
        />
        <View className="absolute inset-0 items-center justify-center gap-[18px] p-6" pointerEvents="none">
          {frame}
          <Text className="text-center font-jakarta-medium text-sm text-white">{hint}</Text>
        </View>
      </>
    );
  } else {
    viewfinder = (
      <View className="h-full w-full items-center justify-center gap-4 p-6">
        <Text className="text-center font-jakarta-medium text-sm text-[#e8e2d9]">
          {blocked
            ? "Camera access is turned off for this app. Turn it on in Settings to take the photo here."
            : `Allow camera access to take a photo of your ${subject}.`}
        </Text>
        {permission && (
          <Pressable
            onPress={blocked ? () => Linking.openSettings() : requestPermission}
            className="rounded-full bg-primary px-5 py-2.5"
          >
            <Text className="font-jakarta-semibold text-sm text-white">
              {blocked ? "Open settings" : "Allow camera"}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="w-full gap-4 px-6 pt-2">
      <View className="h-[392px] w-full overflow-hidden rounded-[20px] bg-[#1a1a1a]">{viewfinder}</View>

      <View className="w-full gap-2.5 rounded-[20px] bg-card p-4 shadow-md shadow-black/10">
        <Text className="font-jakarta-semibold text-base text-foreground">For a clear photo</Text>
        {guidelines.map((g) => (
          <Text key={g} className="text-sm text-muted-foreground">
            ✅ {g}
          </Text>
        ))}
      </View>

      {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

      <View className="gap-3 pt-2">
        {photo ? (
          <>
            <Button disabled={busy} onPress={() => upload(photo)}>
              {busy ? "Uploading…" : "Use photo"}
            </Button>
            <Button disabled={busy} onPress={() => setPhoto(null)} variant="secondary" size="sm">
              Retake
            </Button>
          </>
        ) : (
          <>
            <Button disabled={busy || !granted || !cameraReady} onPress={takePhoto}>
              {busy ? "Uploading…" : "Capture photo"}
            </Button>
            <Button disabled={busy} onPress={pickFromGallery} variant="secondary" size="sm">
              Upload from gallery
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
