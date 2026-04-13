import { useDeleteNote, useMyDownloads, useMyUploads } from "@/hooks/use-notes";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Note } from "@shared/schema";
import { ArrowUpRight, Clock, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { resolveUploadedFileUrl } from "@/lib/backend";

export function MyLibraryCard({ maxItems }: { maxItems?: number }) {
  const { data: myUploads, isLoading: uploadsLoading } = useMyUploads();
  const { data: myDownloads, isLoading: downloadsLoading } = useMyDownloads();
  const deleteNote = useDeleteNote();
  const [noteToDelete, setNoteToDelete] = useState<(Note & { author: string }) | null>(null);

  const uploads = typeof maxItems === "number" ? (myUploads ?? []).slice(0, maxItems) : myUploads;
  const downloads =
    typeof maxItems === "number" ? (myDownloads ?? []).slice(0, maxItems) : myDownloads;
  const pendingDeleteId = deleteNote.variables;

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    try {
      await deleteNote.mutateAsync(noteToDelete.id);
      setNoteToDelete(null);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <>
      <Card className="glass-card rounded-3xl border-border/60 mb-10 fade-up">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-display">My Library</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track what you have uploaded and downloaded.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="bg-primary/8 text-primary">
                {uploadsLoading ? "..." : `${myUploads?.length ?? 0}`} uploaded
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {downloadsLoading ? "..." : `${myDownloads?.length ?? 0}`} downloaded
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="uploaded" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-muted/50 border border-border/60 rounded-2xl p-1">
              <TabsTrigger value="uploaded" className="rounded-xl">
                Uploaded
              </TabsTrigger>
              <TabsTrigger value="downloaded" className="rounded-xl">
                Downloaded
              </TabsTrigger>
            </TabsList>

            <TabsContent value="uploaded" className="mt-5">
              {uploadsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-52" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))}
                </div>
              ) : uploads && uploads.length > 0 ? (
                <div className="space-y-3">
                  {uploads.map((n) => (
                    <div
                      key={n.id}
                      className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{n.title}</span>
                          <Badge variant="secondary" className="bg-primary/6 text-primary">
                            {n.subject}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {n.semester}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            Uploaded{" "}
                            {n.createdAt
                              ? format(new Date(n.createdAt as any), "MMM d, yyyy")
                              : "recently"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <Button
                          variant="outline"
                          onClick={() =>
                            window.open(
                              resolveUploadedFileUrl(n.fileUrl),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          Open <ArrowUpRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => setNoteToDelete(n)}
                          disabled={deleteNote.isPending}
                        >
                          {deleteNote.isPending && pendingDeleteId === n.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
                  <h3 className="font-semibold">No uploads yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload your first note to start building your library.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="downloaded" className="mt-5">
              {downloadsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-4"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-52" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-9 w-24" />
                    </div>
                  ))}
                </div>
              ) : downloads && downloads.length > 0 ? (
                <div className="space-y-3">
                  {downloads.map((n) => (
                    <div
                      key={`${n.id}-${String((n as any).downloadedAt ?? "")}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{n.title}</span>
                          <Badge variant="secondary" className="bg-primary/6 text-primary">
                            {n.subject}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            {n.semester}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            Downloaded{" "}
                            {(n as any).downloadedAt
                              ? format(new Date((n as any).downloadedAt), "MMM d, yyyy")
                              : "recently"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          window.open(
                            resolveUploadedFileUrl(n.fileUrl),
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Open <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
                  <h3 className="font-semibold">No downloads yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Download a note from the list and it will show up here.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!noteToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteNote.isPending) {
            setNoteToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {noteToDelete
                ? `This will permanently remove "${noteToDelete.title}" from Note Hub and delete its uploaded file.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteNote.isPending}
            >
              {deleteNote.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Note
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
