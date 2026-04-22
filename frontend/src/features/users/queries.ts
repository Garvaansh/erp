import { useQuery } from "@tanstack/react-query";
import { usersKeys } from "@/lib/react-query/keys";
import { getUsers } from "@/features/users/api";
import type { UserFilter } from "@/features/users/types";

export function useUsers(filter: UserFilter, search: string) {
  return useQuery({
    queryKey: usersKeys.list(filter, search),
    queryFn: () => getUsers(filter, search),
    staleTime: 30_000,
  });
}
