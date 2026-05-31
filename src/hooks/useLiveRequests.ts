import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { listMyRequests, saveRequestDraft, submitDraft } from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

export function useLiveRequests() {
  const queryClient = useQueryClient();

  const requests = useQuery({
    queryKey: ["requests"],
    queryFn: listMyRequests,
    enabled: isSupabaseEnabled,
  });

  const saveDraft = useMutation({
    mutationFn: ({
      workflowType,
      sourceLocationId,
      payload,
    }: {
      workflowType: string;
      sourceLocationId: string | null;
      payload: Record<string, unknown>;
    }) => saveRequestDraft(workflowType, sourceLocationId, payload),
  });

  const submit = useMutation({
    mutationFn: submitDraft,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });

  return {
    requests,
    saveDraft,
    submit,
  };
}
