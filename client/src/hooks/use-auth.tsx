import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type {
  AuthLoginInput,
  AuthOtpRequestInput,
  AuthOtpVerifyInput,
  AuthRegisterInput,
  ChangePasswordInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  UserProfileInput,
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { resolveApiUrl } from "@/lib/backend";

export function useAuth() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(api.auth.me.path), { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: AuthLoginInput) => {
      const res = await fetch(resolveApiUrl(api.auth.login.path), {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid email/phone or password");
        }
        throw new Error("Login failed");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${(data as any)?.nickName ?? data.username}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const requestLoginCodeMutation = useMutation({
    mutationFn: async (input: AuthOtpRequestInput) => {
      const res = await fetch(resolveApiUrl(api.auth.loginCodeRequest.path), {
        method: api.auth.loginCodeRequest.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to send code";
        throw new Error(message);
      }

      return api.auth.loginCodeRequest.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      if (data.devCode) {
        toast({
          title: "Code sent (dev)",
          description: `Use code ${data.devCode}`,
        });
      } else {
        toast({ title: "Code sent", description: "Check your email/SMS for the code." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not send code", description: error.message, variant: "destructive" });
    },
  });

  const verifyLoginCodeMutation = useMutation({
    mutationFn: async (input: AuthOtpVerifyInput) => {
      const res = await fetch(resolveApiUrl(api.auth.loginCodeVerify.path), {
        method: api.auth.loginCodeVerify.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Invalid code";
        throw new Error(message);
      }

      return api.auth.loginCodeVerify.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "Welcome back!", description: `Logged in as ${data.username}` });
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: AuthRegisterInput) => {
      const res = await fetch(resolveApiUrl(api.auth.register.path), {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.auth.register.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Registration failed");
      }
      return api.auth.register.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "Account created!", description: "Welcome to NoteShare" });
    },
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(resolveApiUrl(api.auth.logout.path), {
        method: api.auth.logout.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      toast({ title: "Logged out", description: "See you next time!" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (input: UserProfileInput) => {
      const res = await fetch(resolveApiUrl(api.auth.updateProfile.path), {
        method: api.auth.updateProfile.method,
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

      return api.auth.updateProfile.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], data);
      toast({ title: "Profile updated", description: "Your department and year were saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const passwordResetRequestMutation = useMutation({
    mutationFn: async (input: PasswordResetRequestInput) => {
      const res = await fetch(resolveApiUrl(api.auth.passwordResetRequest.path), {
        method: api.auth.passwordResetRequest.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to send code";
        throw new Error(message);
      }

      return api.auth.passwordResetRequest.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      if (data.devCode) {
        toast({ title: "Reset code (dev)", description: `Use code ${data.devCode}` });
      } else {
        toast({ title: "Reset code sent", description: "Check your email/SMS." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Could not send code", description: error.message, variant: "destructive" });
    },
  });

  const passwordResetConfirmMutation = useMutation({
    mutationFn: async (input: PasswordResetConfirmInput) => {
      const res = await fetch(resolveApiUrl(api.auth.passwordResetConfirm.path), {
        method: api.auth.passwordResetConfirm.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to reset password";
        throw new Error(message);
      }

      return api.auth.passwordResetConfirm.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "You can sign in now." });
    },
    onError: (error: Error) => {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (input: ChangePasswordInput) => {
      const res = await fetch(resolveApiUrl(api.auth.changePassword.path), {
        method: api.auth.changePassword.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to update password";
        throw new Error(message);
      }

      return api.auth.changePassword.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({ title: "Password updated", description: "Your password was changed." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutate,
    requestLoginCode: requestLoginCodeMutation.mutateAsync,
    verifyLoginCode: verifyLoginCodeMutation.mutateAsync,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    updateProfile: updateProfileMutation.mutateAsync,
    requestPasswordReset: passwordResetRequestMutation.mutateAsync,
    confirmPasswordReset: passwordResetConfirmMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRequestingLoginCode: requestLoginCodeMutation.isPending,
    isVerifyingLoginCode: verifyLoginCodeMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isRequestingPasswordReset: passwordResetRequestMutation.isPending,
    isConfirmingPasswordReset: passwordResetConfirmMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
  };
}
