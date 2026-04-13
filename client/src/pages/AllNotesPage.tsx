import { Layout } from "@/components/Layout";
import { NoteCard } from "@/components/NoteCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAllNotes } from "@/hooks/use-notes";
import { BookOpen, FilterX, Search } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function AllNotesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const { data: notes, isLoading, error } = useAllNotes(search, { enabled: !!user });

  return (
    <Layout>
      <div className="glass-card rounded-3xl p-6 md:p-8 mb-8 fade-up relative overflow-hidden bg-no-repeat bg-[radial-gradient(900px_520px_at_0%_0%,hsl(var(--primary)/0.20),transparent_60%),radial-gradient(900px_540px_at_110%_15%,hsl(var(--chart-4)/0.14),transparent_58%),radial-gradient(820px_520px_at_70%_120%,hsl(var(--chart-3)/0.12),transparent_55%)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground text-balance">
              All notes
            </h1>
            <p className="text-muted-foreground mt-2">
              Browse everything uploaded on the app (across all departments and years).
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/upload">
              <Button size="lg" className="shadow-xs">
                Upload Note
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="shadow-xs">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mb-8 group fade-up" style={{ animationDelay: "60ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          className="pl-12 h-14 text-lg bg-card/70 backdrop-blur border-border/60 hover:border-primary/35 focus-visible:ring-primary/20 transition-all rounded-2xl"
          placeholder="Search by title, subject, or author..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[280px] rounded-xl border bg-card p-6 space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-8 w-3/4 mt-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="pt-8 mt-auto">
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-destructive/5 rounded-2xl border border-destructive/20">
          <h3 className="text-lg font-semibold text-destructive">Error loading notes</h3>
          <p className="text-muted-foreground mt-2">{(error as Error).message}</p>
        </div>
      ) : notes?.length === 0 ? (
        <div className="text-center py-32 bg-muted/30 rounded-3xl border border-dashed border-muted-foreground/20 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            {search ? (
              <FilterX className="h-10 w-10 text-muted-foreground" />
            ) : (
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {search ? "No matches found" : "No notes yet"}
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            {search
              ? "Try adjusting your search terms."
              : "Be the first to share your knowledge with the community!"}
          </p>
          {!search && (
            <Link href="/upload">
              <Button variant="outline" className="mt-6">
                Share a Note
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {notes?.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </Layout>
  );
}

