import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listMyNotifications, resolveNotification } from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

export function useLiveNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: listMyNotifications,
    enabled: isSupabaseEnabled,
  });

  const resolve = useMutation({
    mutationFn: resolveNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    ...query,
    resolveNotification: resolve.mutateAsync,
    resolving: resolve.isPending,
  };
}
