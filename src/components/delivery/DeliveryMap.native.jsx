import { TurboModuleRegistry, View } from "react-native";
import { MapPin } from "lucide-react-native";
import Text from "@/components/ui/Text";

// The rider's map (Home, the order offer, navigation) — real MapLibre where this binary has it,
// a stand-in where it doesn't. Expo Go ships without MapLibre's native code, and the package
// throws the moment it is imported there (TurboModuleRegistry.getEnforcing on MLRNCameraModule),
// which used to crash the whole app at launch. So the real map (MapLibreDeliveryMap.jsx) is only
// `require`d after its native modules are confirmed present — the same check the customer app
// makes in src/lib/mapLibre.ts.
const MAPLIBRE_LINKED = ["MLRNMapViewModule", "MLRNCameraModule"].every(
  (name) => TurboModuleRegistry.get(name) != null,
);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MapLibreDeliveryMap = MAPLIBRE_LINKED ? require("./MapLibreDeliveryMap").default : null;

export default function DeliveryMap(props) {
  if (MapLibreDeliveryMap) return <MapLibreDeliveryMap {...props} />;
  return (
    <View className="flex-1 items-center justify-center gap-1 bg-[#2b2f36]">
      <MapPin size={26} color="#ffffff" />
      <Text className="mt-1 text-center text-xs font-jakarta-semibold text-white">
        The live map needs the full app build.
      </Text>
    </View>
  );
}
