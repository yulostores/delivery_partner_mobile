import { Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

export default function BackButton({ className }) {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.goBack()}
      accessibilityLabel="Go back"
      className={className || "size-10 items-center justify-center rounded-full bg-muted"}
    >
      <ArrowLeft size={18} color="#1a1a1a" />
    </Pressable>
  );
}
