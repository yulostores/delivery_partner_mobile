import { View } from "react-native";
import { MapPin } from "lucide-react-native";
import Text from "@/components/ui/Text";

// Non-crashing stand-in for the browser. See DeliveryMap.native.jsx's header
// comment for why this split exists: @maplibre/maplibre-react-native has no
// web build, and importing it on web throws a fatal, uncaught exception the
// instant the module loads. Metro's platform-extension resolution means web
// never evaluates that import here.
//
// A real web map (maplibre-gl, which does support browsers, unlike this
// native package) is a separate, larger follow-up if wanted.
export default function DeliveryMap() {
  return (
    <View className="flex-1 items-center justify-center gap-1 bg-[#2b2f36]">
      <MapPin size={26} color="#ffffff" />
      <Text className="mt-1 text-center text-xs font-jakarta-semibold text-white">
        Live map preview isn&rsquo;t available on web yet.
      </Text>
    </View>
  );
}
