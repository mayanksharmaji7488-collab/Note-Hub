import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { resolveApiUrl } from "@/lib/backend";

export function useDepartments(opts?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: [api.departments.list.path],
    queryFn: async () => {
      const res = await fetch(resolveApiUrl(api.departments.list.path), {
        credentials: "include",
      });

      if (res.status === 401) return { total: 0, items: [] };
      if (!res.ok) throw new Error("Failed to fetch departments");

      return api.departments.list.responses[200].parse(await res.json());
    },
    enabled: opts?.enabled,
  });

  return {
    ...query,
    departments: query.data?.items ?? [],
    total: query.data?.total ?? 0,
  };
}
