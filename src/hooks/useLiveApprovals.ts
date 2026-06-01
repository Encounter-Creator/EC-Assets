import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listApprovals, listDamageCases, reviewApproval, resolveDamageCase } from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

const ACTIVE_DAMAGE_STATUSES = new Set(["Locked", "Form Pending", "Form Submitted", "Under Review"]);

export function useLiveApprovals() {
  const queryClient = useQueryClient();

  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: listApprovals,
    enabled: isSupabaseEnabled,
  });

  const damageCases = useQuery({
    queryKey: ["damage-cases"],
    queryFn: listDamageCases,
    enabled: isSupabaseEnabled,
    select: (items) => items.filter((item) => ACTIVE_DAMAGE_STATUSES.has(item.status)),
  });

  const approvalReview = useMutation({
    mutationFn: ({
      approvalId,
      status,
      reviewNotes,
    }: {
      approvalId: string;
      status: "Approved" | "Declined" | "Request Changes";
      reviewNotes?: string;
    }) => reviewApproval(approvalId, status, reviewNotes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });

  const damageResolution = useMutation({
    mutationFn: ({
      caseId,
      resolvedState,
      conditionNote,
    }: {
      caseId: string;
      resolvedState: "Available" | "Damaged";
      conditionNote?: string;
    }) => resolveDamageCase(caseId, resolvedState, conditionNote),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["damage-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-out-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-in-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    approvals,
    damageCases,
    reviewApproval: approvalReview.mutateAsync,
    resolveDamage: damageResolution.mutateAsync,
    reviewingApproval: approvalReview.isPending,
    resolvingDamage: damageResolution.isPending,
  };
}
