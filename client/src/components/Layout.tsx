import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  LayoutDashboard, 
  Upload, 
  LogOut, 
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-2xl text-primary">
          <BookOpen className="h-8 w-8" />
          <span>NoteShare</span>
        </Link>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-2">
        <Link href="/">
          <Button 
            variant={location === "/" ? "secondary" : "ghost"} 
            className="w-full justify-start gap-3 text-base h-12"
            onClick={() => setIsOpen(false)}
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </Button>
        </Link>
        <Link href="/upload">
          <Button 
            variant={location === "/upload" ? "secondary" : "ghost"} 
            className="w-full justify-start gap-3 text-base h-12"
            onClick={() => setIsOpen(false)}
          >
            <Upload className="h-5 w-5" />
            Upload Note
          </Button>
        </Link>
      </div>

      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.username}</span>
            <span className="text-xs text-muted-foreground">Student</span>
          </div>
        </div>
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
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card h-screen sticky top-0">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background/80 backdrop-blur-md z-50 flex items-center px-4 justify-between">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-xl text-primary">
          <BookOpen className="h-6 w-6" />
          <span>NoteShare</span>
        </Link>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:h-screen md:overflow-y-auto w-full pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
