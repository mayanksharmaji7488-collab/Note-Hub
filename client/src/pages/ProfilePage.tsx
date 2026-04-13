import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  changePasswordSchema,
  userIdentityUpdateSchema,
  type ChangePasswordInput,
  type UserIdentityUpdateInput,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, MailCheck, PhoneCall } from "lucide-react";

function statusBadge(verified: boolean) {
  return verified ? (
    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/15">
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Not verified
    </Badge>
  );
}

export default function ProfilePage() {
  const { user, changePassword, isChangingPassword } = useAuth();
  const { profile, isLoading, updateProfile, isUpdating, verifyEmail, verifyMobile } =
    useUserProfile();
  const [, setLocation] = useLocation();

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [mobileDialogOpen, setMobileDialogOpen] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [mobileCode, setMobileCode] = useState("");
  const otpSlots = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const form = useForm<UserIdentityUpdateInput>({
    resolver: zodResolver(userIdentityUpdateSchema),
    defaultValues: {
      fullName: "",
      nickName: "",
      email: "",
      mobileNumber: "",
      role: "student",
    },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      fullName: profile.fullName ?? "",
      nickName: profile.nickName ?? "",
      email: profile.email ?? "",
      mobileNumber: profile.mobileNumber ?? "",
      role: profile.role ?? "student",
    });
  }, [profile, form]);

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your identity, role, and verification.
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/")}>
            Back to dashboard
          </Button>
        </div>

        {isLoading ? (
          <Card className="glass-card rounded-3xl border-border/60">
            <CardContent className="p-8 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading profile...
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="glass-card rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl font-display">Basic Info</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(async (data) => {
                      try {
                        await updateProfile(data);
                      } catch {}
                    })}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your full name"
                                className="h-11"
                                {...field}
                                value={(field.value ?? "") as string}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="nickName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nickname</FormLabel>
                            <FormControl>
                              <Input placeholder="Displayed across the app" className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select
                              onValueChange={(value) => field.onChange(value)}
                              value={String(field.value ?? "student")}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="faculty">Faculty</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Card className="rounded-2xl border-border/60">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Identity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <div className="flex items-center justify-between">
                                <FormLabel>Email</FormLabel>
                                {statusBadge(Boolean(profile?.isEmailVerified))}
                              </div>
                              <FormControl>
                                  <Input
                                    placeholder="name@gmail.com"
                                    className="h-11"
                                    {...field}
                                    value={(field.value ?? "") as string}
                                  />
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
                                <div className="flex items-center justify-between">
                                <FormLabel>Mobile</FormLabel>
                                {statusBadge(Boolean(profile?.isMobileVerified))}
                              </div>
                              <FormControl>
                                  <Input
                                    placeholder="+919999999999"
                                    className="h-11"
                                    {...field}
                                    value={(field.value ?? "") as string}
                                  />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => setEmailDialogOpen(true)}
                            disabled={!profile?.email}
                          >
                            <MailCheck className="h-4 w-4" />
                            Verify Email
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                            onClick={() => setMobileDialogOpen(true)}
                            disabled={!profile?.mobileNumber}
                          >
                            <PhoneCall className="h-4 w-4" />
                            Verify Mobile
                          </Button>
                          <div className="flex-1" />
                          <Button type="submit" className="md:w-auto" disabled={isUpdating}>
                            {isUpdating ? "Saving..." : "Save changes"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card className="glass-card rounded-3xl border-border/60">
              <CardHeader>
                <CardTitle className="text-xl font-display">Password</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...passwordForm}>
                  <form
                    onSubmit={passwordForm.handleSubmit(async (data) => {
                      await changePassword(data);
                      passwordForm.reset({ currentPassword: "", newPassword: "" });
                    })}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current password</FormLabel>
                          <FormControl>
                            <Input type="password" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New password</FormLabel>
                          <FormControl>
                            <Input type="password" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" disabled={isChangingPassword}>
                        {isChangingPassword ? "Updating..." : "Update password"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Dialog
              open={emailDialogOpen}
              onOpenChange={(open) => {
                setEmailDialogOpen(open);
                if (!open) setEmailCode("");
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Verify email</DialogTitle>
                  <DialogDescription>
                    Send a code to <span className="font-medium">{profile?.email}</span>.
                  </DialogDescription>
                </DialogHeader>

                <Button
                  type="button"
                  variant="secondary"
                    onClick={async () => {
                      if (!profile?.email) return;
                      try {
                        await verifyEmail({ email: profile.email });
                      } catch {}
                    }}
                  >
                    Send code
                  </Button>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Enter code</div>
                  <InputOTP maxLength={6} value={emailCode} onChange={setEmailCode}>
                    <InputOTPGroup>
                      {otpSlots.map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={async () => {
                      if (!profile?.email) return;
                      try {
                        await verifyEmail({ email: profile.email, code: emailCode });
                        setEmailDialogOpen(false);
                      } catch {}
                    }}
                    disabled={emailCode.length !== 6}
                  >
                    Verify
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={mobileDialogOpen}
              onOpenChange={(open) => {
                setMobileDialogOpen(open);
                if (!open) setMobileCode("");
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Verify mobile</DialogTitle>
                  <DialogDescription>
                    Send a code to <span className="font-medium">{profile?.mobileNumber}</span>.
                  </DialogDescription>
                </DialogHeader>

                <Button
                  type="button"
                  variant="secondary"
                    onClick={async () => {
                      if (!profile?.mobileNumber) return;
                      try {
                        await verifyMobile({ mobileNumber: profile.mobileNumber });
                      } catch {}
                    }}
                  >
                    Send code
                  </Button>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Enter code</div>
                  <InputOTP maxLength={6} value={mobileCode} onChange={setMobileCode}>
                    <InputOTPGroup>
                      {otpSlots.map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={async () => {
                      if (!profile?.mobileNumber) return;
                      try {
                        await verifyMobile({ mobileNumber: profile.mobileNumber, code: mobileCode });
                        setMobileDialogOpen(false);
                      } catch {}
                    }}
                    disabled={mobileCode.length !== 6}
                  >
                    Verify
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </Layout>
  );
}
