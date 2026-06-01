import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listDamageCases, submitDamageForm } from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

const ACTIVE_DAMAGE_STATUSES = new Set(["Locked", "Form Pending", "Form Submitted", "Under Review"]);

export function useLiveDamageLock() {
  const queryClient = useQueryClient();

  const cases = useQuery({
    queryKey: ["my-damage-cases"],
    queryFn: listDamageCases,
    enabled: isSupabaseEnabled,
    select: (items) => items.filter((item) => ACTIVE_DAMAGE_STATUSES.has(item.status)),
  });

  const submit = useMutation({
    mutationFn: ({ caseId, statement }: { caseId: string; statement: string }) => submitDamageForm(caseId, statement),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-damage-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["damage-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    activeCase: cases.data?.[0] ?? null,
    loadingCase: cases.isLoading || cases.isFetching,
    submitDamage: submit.mutateAsync,
    submitting: submit.isPending,
  };
}
