import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  authLoginSchema,
  authOtpRequestSchema,
  authOtpVerifySchema,
  authRegisterSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  type UserRole,
  type AuthLoginInput,
  type AuthOtpRequestInput,
  type AuthOtpVerifyInput,
  type AuthRegisterInput,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
} from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, GraduationCap, Loader2, ShieldCheck, User } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { FcGoogle } from "react-icons/fc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AuthPage() {
  const {
    login,
    register,
    requestLoginCode,
    verifyLoginCode,
    requestPasswordReset,
    confirmPasswordReset,
    isLoggingIn,
    isRegistering,
    isRequestingLoginCode,
    isVerifyingLoginCode,
    isRequestingPasswordReset,
    isConfirmingPasswordReset,
    user,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [resetOpen, setResetOpen] = useState(false);
  const [preAuthRole, setPreAuthRole] = useState<UserRole | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("notehub:preauthRole");
    return raw === "student" || raw === "faculty" ? raw : null;
  });

  if (user) {
    setLocation("/");
    return null;
  }

  useEffect(() => {
    if (preAuthRole) {
      window.sessionStorage.setItem("notehub:preauthRole", preAuthRole);
    }
  }, [preAuthRole]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Brand story */}
      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground relative overflow-hidden bg-[radial-gradient(900px_500px_at_0%_0%,hsl(var(--primary)/0.65),transparent_58%),radial-gradient(900px_520px_at_120%_15%,hsl(42_95%_58%/0.25),transparent_55%),linear-gradient(120deg,hsl(var(--foreground)/0.95),hsl(var(--foreground)/0.88))]">
        <div className="absolute -top-44 -right-44 w-[560px] h-[560px] rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -bottom-44 -left-44 w-[560px] h-[560px] rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute inset-0 opacity-[0.10] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 font-display font-bold text-3xl tracking-tight">
            <BookOpen className="h-10 w-10" />
            <span>NoteShare</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h1 className="text-5xl font-display font-bold leading-tight text-balance">
            Study better. Share faster.
          </h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Upload notes, organize by subject and semester, and keep your
            materials accessible anywhere.
          </p>

          <div className="flex gap-4 pt-4">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-white/15 border-2 border-white/10 flex items-center justify-center"
                >
                  <GraduationCap className="w-5 h-5" />
                </div>
              ))}
            </div>
            <div className="flex flex-col justify-center text-sm font-medium">
              <span>Built for students</span>
              <span className="text-white/60">Simple, focused, fast</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm opacity-60">(c) 2024 NoteShare</div>
      </div>

      {/* Right: Auth */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md glass-card border-border/60 fade-up">
          <CardHeader className="space-y-1 text-center pb-8">
            {!preAuthRole ? (
              <>
                <CardTitle className="text-2xl font-bold">Who are you?</CardTitle>
                <CardDescription>Select your role to continue.</CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                <CardDescription>
                  Sign in to continue, or create an account.
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {!preAuthRole ? (
              <RoleSelection
                onSelect={(role) => {
                  setPreAuthRole(role);
                  window.sessionStorage.setItem("notehub:preauthRole", role);
                }}
              />
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2"
                  onClick={() => {
                    window.location.href = "/api/auth/google/start";
                  }}
                >
                  <FcGoogle className="h-5 w-5" />
                  Continue with Google
                </Button>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <Tabs defaultValue="login" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/60 border border-border/60 rounded-xl">
                    <TabsTrigger
                      value="login"
                      className="h-full rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      className="h-full rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                    >
                      Register
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <Tabs defaultValue="password" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/60 border border-border/60 rounded-xl">
                        <TabsTrigger
                          value="password"
                          className="h-full rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                        >
                          Password
                        </TabsTrigger>
                        <TabsTrigger
                          value="code"
                          className="h-full rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm"
                        >
                          Code
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="password">
                        <LoginPasswordForm
                          onSubmit={login}
                          isLoading={isLoggingIn}
                          onForgotPassword={() => setResetOpen(true)}
                        />
                      </TabsContent>

                      <TabsContent value="code">
                        <LoginCodeForm
                          requestCode={requestLoginCode}
                          verifyCode={verifyLoginCode}
                          isRequesting={isRequestingLoginCode}
                          isVerifying={isVerifyingLoginCode}
                        />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="register">
                    <RegisterForm
                      onSubmit={register}
                      isLoading={isRegistering}
                      role={preAuthRole}
                      onChangeRole={() => {
                        window.sessionStorage.removeItem("notehub:preauthRole");
                        setPreAuthRole(null);
                      }}
                    />
                  </TabsContent>
                </Tabs>

                <ResetPasswordDialog
                  open={resetOpen}
                  onOpenChange={setResetOpen}
                  requestReset={requestPasswordReset}
                  confirmReset={confirmPasswordReset}
                  isRequesting={isRequestingPasswordReset}
                  isConfirming={isConfirmingPasswordReset}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoginPasswordForm({
  onSubmit,
  isLoading,
  onForgotPassword,
}: {
  onSubmit: (data: AuthLoginInput) => void;
  isLoading: boolean;
  onForgotPassword: () => void;
}) {
  const form = useForm<AuthLoginInput>({
    resolver: zodResolver(authLoginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or phone</FormLabel>
              <FormControl>
                <Input placeholder="name@gmail.com or +919999999999" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="password" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            className="h-auto px-2 text-muted-foreground hover:text-foreground"
            onClick={onForgotPassword}
          >
            Forgot password?
          </Button>
        </div>

        <Button type="submit" className="w-full h-11 text-base font-semibold mt-4" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </Form>
  );
}

function LoginCodeForm({
  requestCode,
  verifyCode,
  isRequesting,
  isVerifying,
}: {
  requestCode: (data: AuthOtpRequestInput) => Promise<unknown>;
  verifyCode: (data: AuthOtpVerifyInput) => Promise<unknown>;
  isRequesting: boolean;
  isVerifying: boolean;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const requestForm = useForm<AuthOtpRequestInput>({
    resolver: zodResolver(authOtpRequestSchema),
    defaultValues: { identifier: "" },
  });

  const verifyForm = useForm<AuthOtpVerifyInput>({
    resolver: zodResolver(authOtpVerifySchema),
    defaultValues: { identifier: "", code: "" },
  });

  const slots = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  if (!sentTo) {
    return (
      <Form {...requestForm}>
        <form
          onSubmit={requestForm.handleSubmit(async (data) => {
            const trimmed = data.identifier.trim();
            try {
              await requestCode({ identifier: trimmed });
              setSentTo(trimmed);
              verifyForm.setValue("identifier", trimmed);
            } catch {
              // handled by toast in hook
            }
          })}
          className="space-y-4"
        >
          <FormField
            control={requestForm.control}
            name="identifier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email or phone</FormLabel>
                <FormControl>
                  <Input placeholder="name@gmail.com or +919999999999" className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full h-11 text-base font-semibold mt-4" disabled={isRequesting}>
            {isRequesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Code"
            )}
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...verifyForm}>
      <form
        onSubmit={verifyForm.handleSubmit(async (data) => {
          try {
            await verifyCode(data);
          } catch {
            // handled by toast in hook
          }
        })}
        className="space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground truncate">Code sent to {sentTo}</p>
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-2"
            onClick={() => {
              setSentTo(null);
              requestForm.reset({ identifier: "" });
              verifyForm.reset({ identifier: "", code: "" });
            }}
            disabled={isVerifying || isRequesting}
          >
            Change
          </Button>
        </div>

        <FormField
          control={verifyForm.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verification code</FormLabel>
              <FormControl>
                <InputOTP maxLength={6} value={field.value} onChange={field.onChange}>
                  <InputOTPGroup>
                    {slots.map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 h-11"
            onClick={async () => {
              try {
                await requestCode({ identifier: verifyForm.getValues("identifier") });
              } catch {
                // handled by toast in hook
              }
            }}
            disabled={isRequesting || isVerifying}
          >
            {isRequesting ? "Resending..." : "Resend"}
          </Button>
          <Button type="submit" className="flex-1 h-11 text-base font-semibold" disabled={isVerifying}>
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Sign In"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function RegisterForm({
  onSubmit,
  isLoading,
  role,
  onChangeRole,
}: {
  onSubmit: (data: AuthRegisterInput) => void;
  isLoading: boolean;
  role: UserRole;
  onChangeRole: () => void;
}) {
  const form = useForm<AuthRegisterInput>({
    resolver: zodResolver(authRegisterSchema),
    defaultValues: { nickName: "", email: "", mobileNumber: "", role, password: "" },
  });

  const watchedEmail = form.watch("email");

  useEffect(() => {
    form.setValue("role", role);
  }, [form, role]);

  useEffect(() => {
    const nick = form.getValues("nickName");
    if (nick && nick.trim().length > 0) return;
    if (typeof watchedEmail !== "string") return;
    const base = watchedEmail.split("@")[0]?.trim();
    if (base) {
      form.setValue("nickName", base, { shouldValidate: true });
    }
  }, [watchedEmail, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nickName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nickname</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Rahul" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (optional)</FormLabel>
              <FormControl>
                <Input placeholder="name@gmail.com" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mobileNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile number (optional)</FormLabel>
              <FormControl>
                <Input placeholder="+919999999999" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Role:</span>{" "}
            <span className="font-semibold">{role === "faculty" ? "Faculty" : "Student"}</span>
          </div>
          <Button type="button" variant="ghost" className="h-9 px-2" onClick={onChangeRole}>
            Change
          </Button>
        </div>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="password" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full h-11 text-base font-semibold mt-4" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>
    </Form>
  );
}

function RoleSelection({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-col gap-2 rounded-2xl"
          onClick={() => onSelect("student")}
        >
          <User className="h-6 w-6" />
          Student
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-col gap-2 rounded-2xl"
          onClick={() => onSelect("faculty")}
        >
          <ShieldCheck className="h-6 w-6" />
          Faculty
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        You can change this later in your profile settings.
      </p>
    </div>
  );
}

function ResetPasswordDialog({
  open,
  onOpenChange,
  requestReset,
  confirmReset,
  isRequesting,
  isConfirming,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestReset: (data: PasswordResetRequestInput) => Promise<{ message: string; devCode?: string }>;
  confirmReset: (data: PasswordResetConfirmInput) => Promise<{ message: string }>;
  isRequesting: boolean;
  isConfirming: boolean;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const slots = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  const requestForm = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { identifier: "" },
  });

  const confirmForm = useForm<PasswordResetConfirmInput>({
    resolver: zodResolver(passwordResetConfirmSchema),
    defaultValues: { identifier: "", code: "", newPassword: "" },
  });

  useEffect(() => {
    if (!open) {
      setSentTo(null);
      requestForm.reset({ identifier: "" });
      confirmForm.reset({ identifier: "", code: "", newPassword: "" });
    }
  }, [open, requestForm, confirmForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {sentTo
              ? `Enter the code sent to ${sentTo} and set a new password.`
              : "Get a reset code via email or mobile."}
          </DialogDescription>
        </DialogHeader>

        {!sentTo ? (
          <Form {...requestForm}>
            <form
              onSubmit={requestForm.handleSubmit(async (data) => {
                const res = await requestReset(data);
                setSentTo(data.identifier);
                confirmForm.setValue("identifier", data.identifier);
                if (res.devCode) {
                  confirmForm.setValue("code", res.devCode);
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={requestForm.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email or mobile</FormLabel>
                    <FormControl>
                      <Input placeholder="name@gmail.com or +919999999999" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={isRequesting}>
                {isRequesting ? "Sending..." : "Send code"}
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...confirmForm}>
            <form
              onSubmit={confirmForm.handleSubmit(async (data) => {
                await confirmReset(data);
                onOpenChange(false);
              })}
              className="space-y-4"
            >
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Resetting:</span>{" "}
                  <span className="font-semibold">{sentTo}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 px-2"
                  onClick={() => {
                    setSentTo(null);
                    requestForm.reset({ identifier: "" });
                    confirmForm.reset({ identifier: "", code: "", newPassword: "" });
                  }}
                  disabled={isConfirming || isRequesting}
                >
                  Change
                </Button>
              </div>

              <FormField
                control={confirmForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification code</FormLabel>
                    <FormControl>
                      <InputOTP maxLength={6} value={field.value} onChange={field.onChange}>
                        <InputOTPGroup>
                          {slots.map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={confirmForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="new password" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={isConfirming}>
                {isConfirming ? "Updating..." : "Update password"}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
