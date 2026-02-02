import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useNotes(search?: string) {
  return useQuery({
    queryKey: [api.notes.list.path, search],
    queryFn: async () => {
      const url = search 
        ? `${api.notes.list.path}?search=${encodeURIComponent(search)}` 
        : api.notes.list.path;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return api.notes.list.responses[200].parse(await res.json());
    },
  });
}

export function useNote(id: number) {
  return useQuery({
    queryKey: [api.notes.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.notes.get.path, { id });
      const res = await fetch(url);
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
      // Note: We use fetch directly with FormData, skipping JSON.stringify
      // The browser automatically sets Content-Type to multipart/form-data
      const res = await fetch(api.notes.create.path, {
        method: api.notes.create.method,
        body: formData,
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
      toast({ title: "Success!", description: "Note uploaded successfully." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload failed", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}
