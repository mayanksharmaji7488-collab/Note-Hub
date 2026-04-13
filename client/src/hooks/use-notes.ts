import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { resolveApiUrl } from "@/lib/backend";

export function useNotes(search?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.notes.list.path, search],
    queryFn: async () => {
      const url = search
        ? `${api.notes.list.path}?search=${encodeURIComponent(search)}`
        : api.notes.list.path;

      const res = await fetch(resolveApiUrl(url), { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to fetch notes";
        throw new Error(message);
      }
      return api.notes.list.responses[200].parse(await res.json());
    },
    enabled: opts?.enabled,
  });
}

export function useAllNotes(search?: string, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [api.notes.list.path, "all", search],
    queryFn: async () => {
      const params = new URLSearchParams({ all: "1" });
      if (search) params.set("search", search);
      const url = `${api.notes.list.path}?${params.toString()}`;

      const res = await fetch(resolveApiUrl(url), { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.message === "string" ? body.message : "Failed to fetch notes";
        throw new Error(message);
      }
      return api.notes.list.responses[200].parse(await res.json());
    },
    enabled: opts?.enabled,
  });
}

export function useNotesByDate(
  date: Date | undefined,
  search?: string,
  opts?: { enabled?: boolean },
) {
  const dateParam = date ? format(date, "yyyy-MM-dd") : undefined;

  return useQuery({
    queryKey: [api.notes.byDate.path, dateParam, search],
    queryFn: async () => {
      if (!dateParam) return [];

      const params = new URLSearchParams({ date: dateParam });
      if (search) params.set("search", search);

      const res = await fetch(resolveApiUrl(`${api.notes.byDate.path}?${params.toString()}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return api.notes.byDate.responses[200].parse(await res.json());
    },
    enabled: opts?.enabled && !!dateParam,
  });
}

export function useNote(id: number) {
  return useQuery({
    queryKey: [api.notes.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.notes.get.path, { id });
      const res = await fetch(resolveApiUrl(url), { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch note");
      return api.notes.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(resolveApiUrl(api.notes.create.path), {
        method: api.notes.create.method,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.notes.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 401) {
          throw new Error("Please login to upload notes");
        }
        throw new Error("Failed to upload note");
      }

      return api.notes.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path, "all"] });
      queryClient.invalidateQueries({ queryKey: [api.me.uploads.path] });
      toast({ title: "Success!", description: "Note uploaded successfully." });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (noteId: number) => {
      const url = buildUrl(api.notes.remove.path, { id: noteId });
      const res = await fetch(resolveApiUrl(url), {
        method: api.notes.remove.method,
        credentials: "include",
      });

      if (res.status === 204) {
        return;
      }

      const body = await res.json().catch(() => ({}));
      const message =
        typeof body?.message === "string" ? body.message : "Failed to delete note";

      throw new Error(message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.notes.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.notes.byDate.path] });
      queryClient.invalidateQueries({ queryKey: [api.notes.get.path] });
      queryClient.invalidateQueries({ queryKey: [api.me.uploads.path] });
      queryClient.invalidateQueries({ queryKey: [api.me.downloads.path] });
      toast({ title: "Note deleted", description: "Your note has been removed." });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useMyUploads() {
  return useQuery({
    queryKey: [api.me.uploads.path],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(api.me.uploads.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch uploads");
      return api.me.uploads.responses[200].parse(await res.json());
    },
  });
}

export function useMyDownloads() {
  return useQuery({
    queryKey: [api.me.downloads.path],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(api.me.downloads.path), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch downloads");
      return api.me.downloads.responses[200].parse(await res.json());
    },
  });
}

export function useRecordDownload() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (noteId: number) => {
      const url = buildUrl(api.notes.download.path, { id: noteId });
      const res = await fetch(resolveApiUrl(url), {
        method: api.notes.download.method,
        credentials: "include",
      });
      if (res.status === 404) return;
      if (!res.ok) throw new Error("Failed to record download");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.me.downloads.path] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save download",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
