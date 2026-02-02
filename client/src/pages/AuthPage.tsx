import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, GraduationCap, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function AuthPage() {
  const { login, register, isLoggingIn, isRegistering, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  if (user) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-primary p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=2070')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        {/* Decorative Circles */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-400/10 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 font-display font-bold text-3xl">
            <BookOpen className="h-10 w-10" />
            <span>NoteShare</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <h1 className="text-5xl font-display font-bold leading-tight">
            Knowledge is better when shared.
          </h1>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Join thousands of students sharing lecture notes, research papers, and study guides. Ace your semester together.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="flex -space-x-4">
               {[1,2,3,4].map((i) => (
                 <div key={i} className="w-10 h-10 rounded-full bg-white/20 border-2 border-primary flex items-center justify-center text-xs">
                   <GraduationCap className="w-5 h-5" />
                 </div>
               ))}
            </div>
            <div className="flex flex-col justify-center text-sm font-medium">
              <span>Trusted by students</span>
              <span className="text-white/60">from top universities</span>
            </div>
          </div>
        </div>
        
        <div className="relative z-10 text-sm opacity-60">
          © 2024 NoteShare Platform. Academic Excellence.
        </div>
      </div>

      {/* Right: Auth Forms */}
      <div className="flex items-center justify-center p-6 bg-muted/20">
        <Card className="w-full max-w-md shadow-2xl border-none">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>Enter your details to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted">
                <TabsTrigger value="login" className="h-full rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Login</TabsTrigger>
                <TabsTrigger value="register" className="h-full rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <AuthForm 
                  mode="login" 
                  onSubmit={login} 
                  isLoading={isLoggingIn} 
                />
              </TabsContent>

              <TabsContent value="register">
                <AuthForm 
                  mode="register" 
                  onSubmit={register} 
                  isLoading={isRegistering} 
                />
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-6">
            <p className="text-xs text-center text-muted-foreground px-8">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function AuthForm({ mode, onSubmit, isLoading }: { 
  mode: "login" | "register", 
  onSubmit: (data: InsertUser) => void,
  isLoading: boolean
}) {
  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="student123" className="h-11" {...field} />
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
                <Input type="password" placeholder="••••••••" className="h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full h-11 text-base font-semibold mt-4" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "login" ? "Signing in..." : "Creating account..."}
            </>
          ) : (
            mode === "login" ? "Sign In" : "Create Account"
          )}
        </Button>
      </form>
    </Form>
  );
}
