import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listReturnRequestMonitor,
  listStandardLocations,
  listStandardRecipients,
  listStandardSignInAssets,
  listStandardSignOutAssets,
  standardSignInAssets,
  standardSignOutAssets,
} from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

export function useLiveCheckOperations() {
  const queryClient = useQueryClient();

  const signOutAssets = useQuery({
    queryKey: ["check-standard-sign-out-assets"],
    queryFn: listStandardSignOutAssets,
    enabled: isSupabaseEnabled,
  });

  const signInAssets = useQuery({
    queryKey: ["check-standard-sign-in-assets"],
    queryFn: listStandardSignInAssets,
    enabled: isSupabaseEnabled,
  });

  const recipients = useQuery({
    queryKey: ["check-standard-recipients"],
    queryFn: listStandardRecipients,
    enabled: isSupabaseEnabled,
  });

  const locations = useQuery({
    queryKey: ["check-standard-locations"],
    queryFn: listStandardLocations,
    enabled: isSupabaseEnabled,
  });

  const returnMonitor = useQuery({
    queryKey: ["check-return-monitor"],
    queryFn: listReturnRequestMonitor,
    enabled: isSupabaseEnabled,
  });

  const signOut = useMutation({
    mutationFn: standardSignOutAssets,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-out-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-in-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["my-assigned-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["my-approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const signIn = useMutation({
    mutationFn: standardSignInAssets,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-out-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["check-standard-sign-in-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["my-assigned-assets"] });
      void queryClient.invalidateQueries({ queryKey: ["my-approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["my-damage-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["damage-cases"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
  });

  return {
    signOutAssets,
    signInAssets,
    recipients,
    locations,
    returnMonitor,
    runSignOut: signOut.mutateAsync,
    runSignIn: signIn.mutateAsync,
    signingOut: signOut.isPending,
    signingIn: signIn.isPending,
  };
}
