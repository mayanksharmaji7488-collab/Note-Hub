import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  LayoutDashboard, 
  Globe,
  Library,
  Upload, 
  LogOut, 
  Menu,
  Settings,
  Users
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? ""}`.toUpperCase();
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navButtonClass = (active: boolean) =>
    cn(
      "w-full justify-start gap-3 text-base h-12 rounded-xl transition-all",
      "hover:bg-accent/70 hover:text-foreground",
      active &&
        "bg-accent/80 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--chart-4)/0.10),transparent)] border border-border/60 shadow-sm",
    );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/60">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-bold text-2xl text-foreground"
        >
          <BookOpen className="h-8 w-8" />
          <span className="tracking-tight">NoteShare</span>
        </Link>
        <div className="mt-3 h-px w-full bg-gradient-to-r from-primary/60 via-chart-4/40 to-chart-3/30" />
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-2">
        <Link href="/">
          <Button 
            variant="ghost"
            className={navButtonClass(location === "/")}
            onClick={() => setIsOpen(false)}
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Button>
        </Link>
        <Link href="/notes/all">
          <Button
            variant="ghost"
            className={navButtonClass(location === "/notes/all")}
            onClick={() => setIsOpen(false)}
          >
            <Globe className="h-5 w-5" />
            All Notes
          </Button>
        </Link>
        <Link href="/library">
          <Button
            variant="ghost"
            className={navButtonClass(location === "/library")}
            onClick={() => setIsOpen(false)}
          >
            <Library className="h-5 w-5" />
            My Library
          </Button>
        </Link>
        <Link href="/upload">
          <Button 
            variant="ghost"
            className={navButtonClass(location === "/upload")}
            onClick={() => setIsOpen(false)}
          >
            <Upload className="h-5 w-5" />
            Upload Note
          </Button>
        </Link>
        <Link href="/study">
          <Button
            variant="ghost"
            className={navButtonClass(location === "/study")}
            onClick={() => setIsOpen(false)}
          >
            <Users className="h-5 w-5" />
            Study Together
          </Button>
        </Link>
      </div>

      <div className="p-4 border-t border-border/60 bg-muted/25">
        <div className="flex items-center gap-3 mb-4 px-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initialsFromName(user?.nickName ?? user?.username ?? "User")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">
              {user?.nickName ?? user?.username ?? "User"}
            </span>
            <span className="text-xs text-muted-foreground">
              {(user as any)?.role === "faculty" ? "Faculty" : "Student"}
            </span>
          </div>
        </div>

        <Link href="/profile">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-11 mb-2 hover:bg-accent/70"
            onClick={() => setIsOpen(false)}
          >
            <Settings className="h-4 w-4" />
            Edit Profile
          </Button>
        </Link>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3 border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-72 border-r border-border/60 bg-card/60 backdrop-blur-xl h-screen sticky top-0">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border/60 bg-card/60 backdrop-blur-xl z-50 flex items-center px-4 justify-between">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl text-foreground">
          <BookOpen className="h-6 w-6" />
          <span>NoteShare</span>
        </Link>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 bg-card/70 backdrop-blur-xl border-border/60">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:h-screen md:overflow-y-auto w-full pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-12">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
