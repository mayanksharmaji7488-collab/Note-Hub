import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { UserIdentityUpdateInput, VerifyEmailInput, VerifyMobileInput } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/backend";

export function useUserProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const profileQuery = useQuery({
    queryKey: [api.user.profile.path],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(api.user.profile.path), { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return api.user.profile.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (input: UserIdentityUpdateInput) => {
      const res = await fetch(resolveApiUrl(api.user.updateProfile.path), {
        method: api.user.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to update profile";
        throw new Error(message);
      }

      return api.user.updateProfile.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.user.profile.path], data);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Profile updated", description: "Your changes were saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (input: VerifyEmailInput) => {
      const res = await fetch(resolveApiUrl(api.user.verifyEmail.path), {
        method: api.user.verifyEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Email verification failed";
        throw new Error(message);
      }

      return api.user.verifyEmail.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      const msg = String(data.message || "");
      const isVerified = msg.toLowerCase().includes("verified");

      if (data.devCode) {
        toast({ title: "Code sent (dev)", description: `Use code ${data.devCode}` });
      } else if (isVerified) {
        toast({ title: "Email verified", description: "Your email is now verified." });
      } else {
        toast({ title: "Code sent", description: "Check your email for the code." });
      }
      queryClient.invalidateQueries({ queryKey: [api.user.profile.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    },
  });

  const verifyMobileMutation = useMutation({
    mutationFn: async (input: VerifyMobileInput) => {
      const res = await fetch(resolveApiUrl(api.user.verifyMobile.path), {
        method: api.user.verifyMobile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Mobile verification failed";
        throw new Error(message);
      }

      return api.user.verifyMobile.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      const msg = String(data.message || "");
      const isVerified = msg.toLowerCase().includes("verified");

      if (data.devCode) {
        toast({ title: "Code sent (dev)", description: `Use code ${data.devCode}` });
      } else if (isVerified) {
        toast({ title: "Mobile verified", description: "Your mobile number is now verified." });
      } else {
        toast({ title: "Code sent", description: "Check your SMS for the code." });
      }
      queryClient.invalidateQueries({ queryKey: [api.user.profile.path] });
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    profile: profileQuery.data as any,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error as Error | null,
    updateProfile: updateProfileMutation.mutateAsync,
    verifyEmail: verifyEmailMutation.mutateAsync,
    verifyMobile: verifyMobileMutation.mutateAsync,
    isUpdating: updateProfileMutation.isPending,
    isVerifyingEmail: verifyEmailMutation.isPending,
    isVerifyingMobile: verifyMobileMutation.isPending,
  };
}
