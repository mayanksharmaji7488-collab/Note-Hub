import { useNotes, useNotesByDate } from "@/hooks/use-notes";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import { NoteCard } from "@/components/NoteCard";
import { MyLibraryCard } from "@/components/MyLibraryCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FilterX, BookOpen, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const DEFAULT_BRANCHES = ["CSBS", "CST", "CSD", "CSE"];
  const [branches, setBranches] = useState<string[]>(DEFAULT_BRANCHES);
  const { user, updateProfile, isUpdatingProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [profileDepartment, setProfileDepartment] = useState("");
  const [profileYear, setProfileYear] = useState<number>(1);

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const profileReady = !!user.department && !!user.year;

  useEffect(() => {
    if (user.department && !branches.includes(user.department)) {
      setBranches(prev => [...prev, user.department!]);
    }
    setProfileDepartment(user.department ?? "");
    setProfileYear(user.year ?? 1);
  }, [user.department, user.year]);

  const allNotesQuery = useNotes(search, {
    enabled: profileReady && !selectedDate,
  });
  const dateNotesQuery = useNotesByDate(selectedDate, search, {
    enabled: profileReady && !!selectedDate,
  });
  const notesQuery = selectedDate ? dateNotesQuery : allNotesQuery;
  const { data: notes, isLoading, error } = notesQuery;

  return (
      <Layout>
      {/* Header Section */}
      <div className="glass-card rounded-3xl p-6 md:p-8 mb-8 fade-up relative overflow-hidden bg-no-repeat bg-[radial-gradient(900px_520px_at_0%_0%,hsl(var(--primary)/0.20),transparent_60%),radial-gradient(900px_540px_at_110%_15%,hsl(var(--chart-4)/0.14),transparent_58%),radial-gradient(820px_520px_at_70%_120%,hsl(var(--chart-3)/0.12),transparent_55%)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold text-foreground text-balance">
              Study materials, curated by your peers
            </h1>
            <p className="text-muted-foreground mt-2">
              Search by title or subject, then download instantly.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/notes/all">
              <Button size="lg" variant="outline" className="shadow-xs">
                All Notes
              </Button>
            </Link>
            <Link href="/upload">
              <Button size="lg" className="shadow-xs">
                <Plus className="mr-2 h-5 w-5" />
                Upload New Note
              </Button>
            </Link>
            <Link href="/study">
              <Button size="lg" variant="secondary" className="shadow-xs">
                <Users className="mr-2 h-5 w-5" />
                Study Together
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative mb-8 group fade-up" style={{ animationDelay: "60ms" }}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          className="pl-12 h-14 text-lg bg-card/70 backdrop-blur border-border/60 hover:border-primary/35 focus-visible:ring-primary/20 transition-all rounded-2xl"
          placeholder="Search by title, subject, or author..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!profileReady ? (
        <Card className="glass-card rounded-3xl border-border/60 mb-10 fade-up" style={{ animationDelay: "90ms" }}>
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-display">Complete your profile</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Add your branch and year to see notes shared by your classmates.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-sm font-medium">Branch</span>
                <div className="flex gap-2">
                  <Select value={profileDepartment} onValueChange={setProfileDepartment}>
                    <SelectTrigger className="h-11 flex-1">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => {
                      const newBranch = window.prompt("Enter new branch name:");
                      if (newBranch && newBranch.trim()) {
                        const trimmed = newBranch.trim().toUpperCase();
                        if (!branches.includes(trimmed)) {
                          setBranches(prev => [...prev, trimmed]);
                        }
                        setProfileDepartment(trimmed);
                      }
                    }}
                    title="Add Branch"
                  >
                    <Plus className="h-4 w-4 border-foreground" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Year</span>
                <Select
                  value={String(profileYear)}
                  onValueChange={(value) => setProfileYear(Number(value))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        Year {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                disabled={isUpdatingProfile}
                onClick={async () => {
                  try {
                    await updateProfile({
                      department: profileDepartment,
                      year: profileYear,
                    });
                  } catch {
                    // toast handled in hook
                  }
                }}
              >
                {isUpdatingProfile ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card rounded-3xl border-border/60 mb-10 fade-up" style={{ animationDelay: "90ms" }}>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-display">Browse by date</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Click a date to see notes uploaded that day (your branch + year only).
                </p>
              </div>
              {selectedDate ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/8 text-primary">
                    {format(selectedDate, "MMM d, yyyy")}
                  </Badge>
                  <Button variant="outline" onClick={() => setSelectedDate(undefined)}>
                    Clear
                  </Button>
                </div>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Showing all notes
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur"
            />
          </CardContent>
        </Card>
      )}


      {/* Content Grid */}
      {!profileReady ? null : isLoading ? (
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
            {selectedDate
              ? "No notes on this date"
              : search
                ? "No matches found"
                : "No notes yet"}
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            {selectedDate
              ? "Try another date, or clear the filter to browse all notes."
              : search
                ? "Try adjusting your search terms or filters."
                : "Be the first to share your knowledge with the community!"}
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
