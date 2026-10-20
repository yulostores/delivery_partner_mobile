import { useQuery } from "@tanstack/react-query";

import client from "@/api/client";

// Platform switches for the rider app (GET /partner/config — server/controllers/partner/
// config.controller.js). Today that's just `codEnabled`: cash on delivery is switched off in
// Finance Settings, so no new order is COD and the cash-in-hand / deposit screens have nothing
// to show. Treated as off until the server says otherwise — showing COD screens to a rider who
// can't have a COD order is the worse mistake.
export function usePartnerConfig() {
  const { data } = useQuery({
    queryKey: ["partner", "config"],
    queryFn: () => client.get("/partner/config"),
    staleTime: 5 * 60_000,
  });
  return { codEnabled: data?.config?.codEnabled === true };
}
