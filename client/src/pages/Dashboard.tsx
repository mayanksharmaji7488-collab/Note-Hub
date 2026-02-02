import { useNotes } from "@/hooks/use-notes";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import { NoteCard } from "@/components/NoteCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, FilterX, BookOpen } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const { data: notes, isLoading, error } = useNotes(search);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <Layout>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Study Materials
          </h1>
          <p className="text-muted-foreground mt-1">
            Access and download notes shared by your peers.
          </p>
        </div>
        <Link href="/upload">
          <Button size="lg" className="shadow-lg hover:shadow-xl transition-all">
            <Plus className="mr-2 h-5 w-5" />
            Upload New Note
          </Button>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative mb-8 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          className="pl-12 h-14 text-lg bg-white shadow-sm border-muted hover:border-primary/50 focus-visible:ring-primary/20 transition-all rounded-xl"
          placeholder="Search by title, subject, or author..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content Grid */}
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
          <p className="text-muted-foreground mt-2">{error.message}</p>
        </div>
      ) : notes?.length === 0 ? (
        <div className="text-center py-32 bg-muted/30 rounded-3xl border border-dashed border-muted-foreground/20 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
            {search ? <FilterX className="h-10 w-10 text-muted-foreground" /> : <BookOpen className="h-10 w-10 text-muted-foreground" />}
          </div>
          <h3 className="text-xl font-bold text-foreground">
            {search ? "No matches found" : "No notes yet"}
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            {search ? "Try adjusting your search terms or filters." : "Be the first to share your knowledge with the community!"}
          </p>
          {!search && (
             <Link href="/upload">
               <Button variant="outline" className="mt-6">Share a Note</Button>
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
