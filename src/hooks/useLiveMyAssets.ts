import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listApprovals, listDamageCases, listMyAssignedAssets, recipientReviewAssignments } from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

const ACTIVE_DAMAGE_STATUSES = new Set(["Locked", "Form Pending", "Form Submitted", "Under Review"]);

export function useLiveMyAssets() {
  const queryClient = useQueryClient();
  const assignedAssets = useQuery({
    queryKey: ["my-assigned-assets"],
    queryFn: listMyAssignedAssets,
    enabled: isSupabaseEnabled,
  });

  const pendingApprovals = useQuery({
    queryKey: ["my-approvals"],
    queryFn: listApprovals,
    enabled: isSupabaseEnabled,
    select: (items) => items.filter((item) => item.approval_type === "recipient" && item.status === "Awaiting Recipient"),
  });

  const damageCases = useQuery({
    queryKey: ["my-damage-cases"],
    queryFn: listDamageCases,
    enabled: isSupabaseEnabled,
  });

  const reviewRecipientAssignments = useMutation({
    mutationFn: recipientReviewAssignments,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-assigned-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["my-approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-out-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-in-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    assignedAssets,
    pendingApprovals,
    damageCases,
    reviewAssignments: reviewRecipientAssignments.mutateAsync,
    reviewingAssignments: reviewRecipientAssignments.isPending,
    loading: assignedAssets.isLoading || pendingApprovals.isLoading || damageCases.isLoading,
    activeDamageCases: damageCases.data?.filter((item) => ACTIVE_DAMAGE_STATUSES.has(item.status)) ?? [],
    resolvedDamageCases: damageCases.data?.filter((item) => !ACTIVE_DAMAGE_STATUSES.has(item.status)) ?? [],
  };
}
