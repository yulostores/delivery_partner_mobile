import { useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Check } from "lucide-react-native";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Screen from "@/components/ui/Screen";
import Text from "@/components/ui/Text";
import AppBar from "@/components/partner/AppBar";
import client from "@/api/client";

// Minimal real form — the existing SupportHelp.jsx row had no subject/description UI at all
// (nothing for POST /api/partner/support/tickets to send), so this is the smallest new screen
// that actually collects what the backend needs.
export default function ReportIssue() {
  const navigation = useNavigation();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!subject.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await client.post("/partner/support/tickets", {
        subject: subject.trim(),
        description: description.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Screen edges={["top"]}>
        <AppBar title="Report an issue" onBack={true} />
        <View className="w-full flex-1 items-center gap-6 px-6 pt-16">
          <View className="size-16 items-center justify-center rounded-full bg-success-tint">
            <Check size={28} color="#22a853" strokeWidth={3} />
          </View>
          <View className="items-center gap-1.5">
            <Text className="text-center font-jakarta-bold text-xl text-foreground">
              Issue reported
            </Text>
            <Text className="text-center text-base text-muted-foreground">
              Our support team will get back to you soon.
            </Text>
          </View>
          <Button className="w-full" onPress={() => navigation.goBack()}>
            Done
          </Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <AppBar title="Report an issue" onBack={true} />

      <View className="w-full flex-1 gap-4 px-6 pt-5">
        <View className="gap-1.5">
          <Text className="font-jakarta-medium text-xs text-muted-foreground">Subject</Text>
          <Input value={subject} onChangeText={setSubject} placeholder="Briefly describe the issue" className="rounded-2xl" />
        </View>

        <View className="gap-1.5">
          <Text className="font-jakarta-medium text-xs text-muted-foreground">Description</Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="What happened? Include any order IDs or screens involved."
            multiline
            numberOfLines={5}
            className="h-32 rounded-2xl py-3"
            style={{ textAlignVertical: "top" }}
          />
        </View>

        {error && <Text className="text-center text-sm text-destructive">{error}</Text>}

        <Button disabled={!subject.trim() || !description.trim() || submitting} onPress={handleSubmit}>
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </View>
    </Screen>
  );
}
